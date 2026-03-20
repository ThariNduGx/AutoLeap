import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/faqs/suggest
 * Analyses recent conversations to suggest FAQ entries using Gemini.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = getSupabaseClient();

  // Pull last 80 conversations that have some history
  const { data: convos } = await (supabase.from('conversations') as any)
    .select('history')
    .eq('business_id', session.businessId)
    .not('history', 'eq', '[]')
    .order('updated_at', { ascending: false })
    .limit(80);

  if (!convos?.length) {
    return NextResponse.json({ suggestions: [] });
  }

  // Flatten conversation history into a transcript block
  const transcripts = (convos as any[])
    .slice(0, 60)
    .map((c: any) => {
      const history: any[] = Array.isArray(c.history) ? c.history : [];
      return history
        .map((h: any) => {
          const text = h.parts?.[0]?.text || '';
          if (!text || text.length > 500) return null;
          return `${h.role === 'user' ? 'Customer' : 'Bot'}: ${text}`;
        })
        .filter(Boolean)
        .join('\n');
    })
    .filter(t => t.trim().length > 10)
    .join('\n---\n')
    .slice(0, 12000); // Cap at 12k chars to stay within token budget

  if (!transcripts.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  const { llm } = await import('@/lib/infrastructure/llm-adapter');

  const prompt = `You are analysing customer service conversations for a service booking business.
Based on the conversations below, identify the top 8 DISTINCT questions customers asked (not about booking steps — focus on informational questions about the business, services, prices, policies, hours, etc.).
For each question, write a clear, helpful answer based on what the bot replied or what seems reasonable for a service business.

Return ONLY a valid JSON array of objects. Each object: { "question": "...", "answer": "..." }
No markdown, no explanation, just the JSON array.

Conversations:
${transcripts}`;

  try {
    const response = await llm.chat.completions.create({
      model: 'gpt-4o-mini' as any,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.4,
    });

    const raw = response.choices[0].message.content || '[]';
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const suggestions = JSON.parse(cleaned);

    if (!Array.isArray(suggestions)) return NextResponse.json({ suggestions: [] });

    return NextResponse.json({
      suggestions: suggestions
        .filter((s: any) => s.question && s.answer)
        .slice(0, 8)
        .map((s: any) => ({ question: String(s.question).trim(), answer: String(s.answer).trim() })),
    });
  } catch (err) {
    console.error('[FAQ SUGGEST] Error:', err);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
