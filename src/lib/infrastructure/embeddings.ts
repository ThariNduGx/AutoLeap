import { llm } from './llm-adapter';
import { getSupabaseClient } from './supabase';
import { calculateActualCost, commitCost } from './cost-tracker';

/**
 * Generate embeddings for text using OpenAI.
 */
export async function generateEmbedding(
  text: string,
  businessId: string
): Promise<number[] | null> {
  try {
    console.log('[EMBEDDINGS] Generating for text:', text.substring(0, 50));

    // Use Gemini embedding model if in dev mode, otherwise OpenAI
    const model = process.env.USE_GEMINI_FOR_DEV === 'true'
      ? 'text-embedding-004'  // Current stable model (works until Jan 2026)
      : 'text-embedding-3-small';

    const response = await llm.embeddings.create({
      model: model,
      input: text,
    });

    const embedding = response.data[0].embedding;

    // Track cost (will be $0 for Gemini free tier)
    const tokensUsed = response.usage?.total_tokens || 0;
    const cost = calculateActualCost(model as any, tokensUsed, 0);

    await commitCost(businessId, cost, model as any, tokensUsed, 0);

    console.log('[EMBEDDINGS] ✅ Generated, cost:', cost.toFixed(6));

    return embedding;
  } catch (error) {
    console.error('[EMBEDDINGS] Failed:', error);
    return null;
  }
}

/**
 * Store FAQ with its embedding.
 */
export async function storeFAQ(
  businessId: string,
  question: string,
  answer: string,
  category?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    // 1. Store FAQ document
    const { data: faqDoc, error: faqError } = await (supabase
      .from('faq_documents') as any)
      .insert({
        business_id: businessId,
        question,
        answer,
        category,
      })
      .select()
      .single();

    if (faqError || !faqDoc) {
      console.error('[FAQ] Failed to store document:', faqError);
      return false;
    }

    // 2. Generate and store embedding (non-fatal — FAQ is usable without it)
    try {
      const textToEmbed = `${question} ${answer}`;
      const embedding = await generateEmbedding(textToEmbed, businessId);

      if (!embedding) {
        console.warn('[FAQ] ⚠️ Embedding generation failed — FAQ saved without embedding');
      } else {
        const isGemini = process.env.USE_GEMINI_FOR_DEV === 'true';
        const embeddingColumn = isGemini ? 'embedding_gemini' : 'embedding';

        const { error: embeddingError } = await (supabase
          .from('faq_embeddings') as any)
          .insert({
            faq_id: faqDoc.id,
            [embeddingColumn]: embedding,
          });

        if (embeddingError) {
          console.warn('[FAQ] ⚠️ Embedding storage failed — FAQ saved without embedding:', embeddingError.message);
        } else {
          console.log('[FAQ] ✅ Embedding stored');
        }
      }
    } catch (embErr) {
      console.warn('[FAQ] ⚠️ Embedding step threw — FAQ saved without embedding:', embErr);
    }

    console.log('[FAQ] ✅ Stored FAQ:', question.substring(0, 50));
    return true;
  } catch (error) {
    console.error('[FAQ] Exception:', error);
    return false;
  }
}

/**
 * Search FAQs using semantic similarity.
 */
export async function searchFAQs(
  businessId: string,
  query: string,
  matchThreshold: number = 0.6,
  matchCount: number = 3
): Promise<Array<{ question: string; answer: string; similarity: number }>> {
  const supabase = getSupabaseClient();

  try {
    // 1. Generate query embedding
    const queryEmbedding = await generateEmbedding(query, businessId);

    if (!queryEmbedding) {
      console.error('[FAQ] Failed to generate query embedding');
      return [];
    }

    // 2. Search using RPC function
    const isGemini = process.env.USE_GEMINI_FOR_DEV === 'true';
    const rpcName = isGemini ? 'match_faqs_gemini' : 'match_faqs';

    console.log(`[FAQ] Searching via ${rpcName}...`);

    const { data, error } = await (supabase.rpc as any)(rpcName, {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      p_business_id: businessId,
    });

    if (error) {
      console.error('[FAQ] Search failed:', error);
      return [];
    }

    console.log('[FAQ] ✅ Found', data?.length || 0, 'matches');

    if (data && data.length > 0) {
      // Increment hit_count for each matched FAQ (fire-and-forget)
      incrementFAQHits(supabase, data.map((r: any) => r.id).filter(Boolean));
      return data;
    }

    // Hybrid fallback: keyword search when semantic returns nothing
    console.log('[FAQ] Semantic miss — trying keyword fallback...');
    const { data: kwData, error: kwError } = await (supabase.rpc as any)('search_faqs_keyword', {
      p_business_id: businessId,
      p_query: query,
      p_limit: matchCount,
    });

    if (kwError) {
      console.error('[FAQ] Keyword search failed:', kwError);
      return [];
    }

    console.log('[FAQ] Keyword results:', kwData?.length || 0);
    if (kwData && kwData.length > 0) {
      incrementFAQHits(supabase, kwData.map((r: any) => r.id).filter(Boolean));
    }
    return kwData || [];
  } catch (error) {
    console.error('[FAQ] Search exception:', error);
    return [];
  }
}

/**
 * Increment hit_count for matched FAQs.
 * Fire-and-forget — never throws.
 */
function incrementFAQHits(supabase: ReturnType<typeof getSupabaseClient>, ids: string[]): void {
  if (ids.length === 0) return;
  (supabase.rpc as any)('increment_faq_hits', { p_ids: ids }).then(
    () => { /* no-op */ },
    (err: any) => console.warn('[FAQ] hit_count increment failed (non-fatal):', err)
  );
}