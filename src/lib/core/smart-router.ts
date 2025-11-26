export type IntentType = 'booking' | 'faq' | 'greeting' | 'status' | 'complaint' | 'unknown';

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
      /\b(issue|problem|wrong|broken|cancel|refund|not working|bad|terrible)\b/i,
      /\b(complaint|complain|disappointed|unhappy)\b/i,
    ],
    priority: 7,
  },
  {
    intent: 'faq',
    patterns: [
      /\b(how much|price|cost|rate|pricing|charge|fee)\b/i,
      /\b(what|how|when|where|which|why)\b/i,
      /\b(service|offer|provide|available|coverage|area)\b/i,
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
 * Determine which model to use based on intent.
 * Cheap models for simple tasks, powerful models for complex ones.
 */
export function selectModel(intent: IntentType): 'gpt-4o-mini' | 'gpt-4o' {
  switch (intent) {
    case 'greeting':
    case 'status':
      return 'gpt-4o-mini'; // Simple responses, cheap model
    
    case 'faq':
      return 'gpt-4o-mini'; // RAG-assisted, cheap model sufficient
    
    case 'booking':
    case 'complaint':
      return 'gpt-4o'; // Complex tool-calling, needs powerful model
    
    case 'unknown':
    default:
      return 'gpt-4o-mini'; // Start cheap, escalate if needed
  }
}