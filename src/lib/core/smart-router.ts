export type IntentType = 'booking' | 'cancellation' | 'reschedule' | 'faq' | 'greeting' | 'status' | 'complaint' | 'unknown';

interface IntentPattern {
  intent: IntentType;
  patterns: RegExp[];
  priority: number; // Higher priority checked first
}

const INTENT_RULES: IntentPattern[] = [
  {
    intent: 'greeting',
    patterns: [
      /^(hi|hello|hey|good morning|good afternoon|good evening)/i,
    ],
    priority: 10,
  },
  {
    intent: 'reschedule',
    patterns: [
      /\b(reschedule|rebook|change.*appointment|move.*appointment|different.*time|another.*time|new.*time)\b/i,
      /\b(change|move|shift)\b.*\b(booking|slot|appointment)\b/i,
    ],
    priority: 10, // Same priority as cancellation — check before booking
  },
  {
    intent: 'cancellation',
    patterns: [
      /^\/cancel\b/i,
      /\b(cancel|cancell?ation)\b.*\b(appointment|booking|reservation|slot)\b/i,
      /\b(cancel|cancell?ation)\b.*\b(my|the)\b/i,
      /\bdon'?t.*want.*appointment\b/i,
    ],
    priority: 10, // Same as greeting — check before booking
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
      // NOTE: 'cancel' intentionally excluded — handled by cancellation intent at higher priority
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
 * Classify user intent using regex patterns (NO API CALLS).
 * This is the first filter - cheap and fast.
 */
export function classifyIntent(message: string): IntentType {
  const normalized = message.trim().toLowerCase();

  // Sort by priority and find first match
  const sortedRules = [...INTENT_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        console.log('[ROUTER] Intent detected:', rule.intent, '|', message.substring(0, 50));
        return rule.intent;
      }
    }
  }

  return 'unknown';
}

/**
 * Determine which model to use based on intent and the active provider.
 * Cheap models for simple tasks, powerful models for complex ones.
 * Returns the correct model name for cost tracking.
 */
export function selectModel(intent: IntentType): string {
  // When running in Gemini dev mode, all completions use gemini-flash-latest.
  // Returning the correct name here ensures cost-tracker records $0 (free tier),
  // not incorrect OpenAI pricing.
  const useGemini = process.env.USE_GEMINI_FOR_DEV === 'true';
  if (useGemini) {
    return 'gemini-flash-latest';
  }

  switch (intent) {
    case 'greeting':
    case 'status':
      return 'gpt-4o-mini'; // Simple responses, cheap model

    case 'faq':
      return 'gpt-4o-mini'; // RAG-assisted, cheap model sufficient

    case 'booking':
    case 'cancellation':
    case 'reschedule':
    case 'complaint':
      return 'gpt-4o'; // Complex tool-calling, needs powerful model

    case 'unknown':
    default:
      return 'gpt-4o-mini'; // Start cheap, escalate if needed
  }
}