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

    // 2. Generate embedding for question + answer
    const textToEmbed = `${question} ${answer}`;
    const embedding = await generateEmbedding(textToEmbed, businessId);

    if (!embedding) {
      console.error('[FAQ] Failed to generate embedding');
      return false;
    }

    // 3. Store embedding (in the correct column based on provider)
    const isGemini = process.env.USE_GEMINI_FOR_DEV === 'true';
    const embeddingColumn = isGemini ? 'embedding_gemini' : 'embedding';
    
    const { error: embeddingError } = await (supabase
      .from('faq_embeddings') as any)
      .insert({
        faq_id: faqDoc.id,
        [embeddingColumn]: embedding,
      });

    if (embeddingError) {
      console.error('[FAQ] Failed to store embedding:', embeddingError);
      return false;
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
  matchThreshold: number = 0.7,
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
    const { data, error } = await (supabase.rpc as any)('match_faqs', {
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
    
    return data || [];
  } catch (error) {
    console.error('[FAQ] Search exception:', error);
    return [];
  }
}