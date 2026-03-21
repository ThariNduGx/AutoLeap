export type IntentType = 'booking' | 'cancellation' | 'reschedule' | 'faq' | 'greeting' | 'status' | 'complaint' | 'unknown';

interface IntentPattern {
  intent: IntentType;
  patterns: RegExp[];
  priority: number;
}

const INTENT_RULES: IntentPattern[] = [
  {
    intent: 'greeting',
    patterns: [/^(hi|hello|hey|good morning|good afternoon|good evening)/i],
    priority: 10,
  },
  {
    intent: 'reschedule',
    patterns: [
      /\b(reschedule|rebook|change.*appointment|move.*appointment|different.*time|another.*time|new.*time)\b/i,
      /\b(change|move|shift)\b.*\b(booking|slot|appointment)\b/i,
    ],
    priority: 10,
  },
  {
    intent: 'cancellation',
    patterns: [
      /^\/cancel\b/i,
      /\b(cancel|cancell?ation)\b.*\b(appointment|booking|reservation|slot)\b/i,
      /\b(cancel|cancell?ation)\b.*\b(my|the)\b.*\b(appointment|booking|reservation|slot|visit)\b/i,
      /\b(i (want|need|would like) to cancel)\b/i,
      /\bdon'?t.*want.*appointment\b/i,
    ],
    priority: 10,
  },
  {
    intent: 'booking',
    patterns: [
      /\b(book|schedule|appointment|reserve|slot|available|availability)\b/i,
      /\b(tomorrow|today|next week|this weekend)\b.*\b(time|slot|appointment)\b/i,
    ],
    priority: 9,
  },
  {
    intent: 'status',
    patterns: [
      /\b(where|status|arrived|on the way|coming|reached|done|finished)\b/i,
      /\b(track|tracking)\b/i,
    ],
    priority: 8,
  },
  {
    intent: 'complaint',
    patterns: [
      /\b(issue|problem|wrong|broken|refund|not working|bad|terrible|awful|horrible)\b/i,
      /\b(complaint|complain|disappointed|unhappy|frustrated|angry|upset)\b/i,
      /\b(never again|worst|useless|scam|rude|poor service)\b/i,
    ],
    priority: 7,
  },
  {
    intent: 'faq',
    patterns: [
      /\b(how much|price|cost|rate|pricing|charge|fee)\b/i,
      /\b(what|how|when|where|which|why)\b/i,
      /\b(service|offer|provide|available|coverage|area)\b/i,
      /\b(do you|can i|is it|are you)\b/i,
      /\b(credit|card|payment|pay|cash|visa|mastercard)\b/i,
      /\b(open|close|hours|time|working)\b/i,
    ],
    priority: 5,
  },
];

/**
 * Fast regex-based classifier — used as a cheap first pass.
 */
export function classifyIntent(message: string): IntentType {
  const normalized = message.trim().toLowerCase();
  const sorted = [...INTENT_RULES].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        console.log('[ROUTER] Intent detected (regex):', rule.intent, '|', message.substring(0, 50));
        return rule.intent;
      }
    }
  }
  return 'unknown';
}

/**
 * LLM-based intent classifier using Gemini Flash.
 * Returns intent + extracted entities. Falls back to regex on error.
 * Cost: ~$0.00001 per call — negligible.
 */
export async function classifyIntentLLM(message: string): Promise<{
  intent: IntentType;
  entities: {
    service?: string;
    date?: string;
    time?: string;
    is_price_query?: boolean;
  };
}> {
  // Fast-path: obvious greetings/cancellations don't need LLM
  const fastIntent = classifyIntent(message);
  if (['greeting', 'cancellation', 'reschedule'].includes(fastIntent)) {
    return { intent: fastIntent, entities: {} };
  }

  try {
    const { llm } = await import('../infrastructure/llm-adapter');
    const prompt = `Classify this customer message for a service booking business.
Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "intent": one of ["booking","faq","complaint","status","unknown"],
  "service": "mentioned service name or null",
  "date": "mentioned date in natural language or null",
  "time": "mentioned time or null",
  "is_price_query": true/false
}

Message: "${message.replace(/"/g, "'")}"`;

    const response = await llm.chat.completions.create({
      model: 'gpt-4o-mini' as any,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 80,
      temperature: 0,
    });

    const raw = response.choices[0].message.content || '{}';
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const intent: IntentType = (
      ['booking', 'faq', 'complaint', 'status', 'cancellation', 'reschedule', 'greeting', 'unknown'].includes(parsed.intent)
        ? parsed.intent
        : 'unknown'
    ) as IntentType;

    console.log('[ROUTER] Intent detected (LLM):', intent, '|', message.substring(0, 50));
    return {
      intent,
      entities: {
        service:        parsed.service || undefined,
        date:           parsed.date    || undefined,
        time:           parsed.time    || undefined,
        is_price_query: !!parsed.is_price_query,
      },
    };
  } catch (err) {
    console.warn('[ROUTER] LLM classification failed, falling back to regex:', err);
    return { intent: fastIntent, entities: {} };
  }
}

/**
 * Determine model based on intent.
 */
export function selectModel(intent: IntentType): 'gemini-flash-latest' | 'gpt-4o-mini' | 'gpt-4o' {
  const useGemini = process.env.USE_GEMINI_FOR_DEV === 'true';
  if (useGemini) return 'gemini-flash-latest';

  switch (intent) {
    case 'greeting':
    case 'status':
      return 'gpt-4o-mini';
    case 'faq':
      return 'gpt-4o-mini';
    case 'booking':
    case 'cancellation':
    case 'reschedule':
    case 'complaint':
      return 'gpt-4o';
    default:
      return 'gpt-4o-mini';
  }
}
