// src/lib/core/queue-processor.ts

import { getSupabaseClient } from '../infrastructure/supabase';
import { classifyIntent, classifyIntentLLM, selectModel } from './smart-router';
import { estimateCost, requestBudget, calculateActualCost, commitCost } from '../infrastructure/cost-tracker';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calendarToolsForGemini, executeCalendarTool } from './tools/calendar-tools';
import type { InlineKeyboardButton } from '../infrastructure/telegram';

interface QueueItem {
  id: string;
  business_id: string;
  raw_payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  created_at: string;
}

/** Exponential backoff: 2^attempt minutes (2m, 4m, 8m) */
function retryDelayMinutes(attempt: number): number {
  return Math.pow(2, attempt + 1);
}

interface ProcessingResult {
  success: boolean;
  response?: string;
  error?: string;
  costIncurred: number;
  keyboard?: InlineKeyboardButton[][];
  /** Messenger quick-reply slots { date, slots[] } when platform is 'messenger' */
  messengerSlots?: { date: string; slots: string[] };
}

interface Conversation {
  id: string;
  business_id: string;
  customer_chat_id: string;
  intent: string;
  state: any;
  history: any[];
  last_message_at: string;
  created_at: string;
  expires_at: string;
}

/**
 * Main queue processor - pulls pending items and routes them.
 * Uses claim_queue_items() SQL function which atomically marks rows as
 * 'processing' using FOR UPDATE SKIP LOCKED, preventing duplicate processing
 * when two cron invocations overlap.
 */
export async function processQueue(batchSize: number = 10): Promise<number> {
  const supabase = getSupabaseClient();

  console.log('[QUEUE] Starting batch processing...');

  // Atomic claim: SELECT + UPDATE in one statement with SKIP LOCKED
  const { data: items, error: fetchError } = await (supabase.rpc as any)(
    'claim_queue_items',
    { p_batch_size: batchSize }
  );

  if (fetchError) {
    console.error('[QUEUE] Failed to claim items:', fetchError);
    return 0;
  }

  if (!items || items.length === 0) {
    console.log('[QUEUE] No pending items');
    return 0;
  }

  console.log(`[QUEUE] Processing ${items.length} items`);

  let processedCount = 0;
  for (const item of items as QueueItem[]) {
    try {
      await processItem(item);
      processedCount++;
    } catch (err) {
      console.error('[QUEUE] Failed to process item:', item.id, err);

      const retryCount = (item.retry_count ?? 0) + 1;
      const MAX_RETRIES = 3;

      if (retryCount < MAX_RETRIES) {
        // Schedule a retry with exponential backoff
        const delayMs = retryDelayMinutes(item.retry_count ?? 0) * 60 * 1000;
        const retryAt = new Date(Date.now() + delayMs).toISOString();
        await (supabase.from('request_queue') as any)
          .update({
            status: 'failed',
            retry_count: retryCount,
            retry_at: retryAt,
            error_message: err instanceof Error ? err.message : String(err),
          })
          .eq('id', item.id);
        console.warn(`[QUEUE] Scheduled retry ${retryCount}/${MAX_RETRIES} for item ${item.id} at ${retryAt}`);
      } else {
        // Dead-lettered: give up and mark permanently failed
        await (supabase.from('request_queue') as any)
          .update({
            status: 'failed',
            retry_count: retryCount,
            retry_at: null,
            error_message: err instanceof Error ? err.message : String(err),
          })
          .eq('id', item.id);
        console.error(`[QUEUE] ☠️ Dead-lettered item ${item.id} after ${retryCount} attempts`);
      }
    }
  }

  console.log(`[QUEUE] ✅ Processed ${processedCount}/${items.length} items`);
  return processedCount;
}

/**
 * Process a single queue item.
 */
async function processItem(item: QueueItem): Promise<void> {
  // Status already set to 'processing' by claim_queue_items() atomically
  console.log('[QUEUE] Processing item:', item.id);

  // Detect platform and extract message
  const platform = item.raw_payload?.platform || 'telegram';
  const message = platform === 'messenger'
    ? extractMessengerMessage(item.raw_payload)
    : extractMessage(item.raw_payload);

  if (!message) {
    console.warn('[QUEUE] No message found in payload:', item.id);
    await markCompleted(item.id, 'No message found');
    return;
  }

  console.log(`[QUEUE] [${platform.toUpperCase()}] Message:`, message.text.substring(0, 50));

  // Inline keyboard slot selections are always booking continuations
  const isSlotCallback = message.text.startsWith('slot:');

  // Skip AI if this conversation has been handed to a human
  const activeConv = await getActiveConversation(item.business_id, message.chatId);
  if (activeConv && (activeConv as any).status === 'human') {
    console.log('[QUEUE] Conversation is in human mode — skipping AI');
    await markCompleted(item.id, 'human_mode');
    return;
  }

  // C1: LLM-based intent classification (falls back to regex internally)
  let intent: string;
  let intentEntities: Record<string, any> = {};
  if (isSlotCallback) {
    intent = 'booking';
  } else {
    const { intent: llmIntent, entities } = await classifyIntentLLM(message.text);
    intent = llmIntent;
    intentEntities = entities;
  }

  const model = selectModel(intent as any);
  console.log('[QUEUE] Intent:', intent, '| Entities:', intentEntities, '| Model:', model);

  const estimate = estimateCost(model, message.text, 150);
  const budgetApproved = await requestBudget(item.business_id, estimate);

  if (!budgetApproved) {
    console.warn('[QUEUE] ⚠️ Budget exceeded, rejecting message');
    await markCompleted(item.id, 'Budget exceeded - please upgrade plan');
    return;
  }

  let result: ProcessingResult;

  switch (intent) {
    case 'greeting':
      result = await handleGreeting(message, item.business_id);
      break;

    case 'faq':
      result = await handleFAQ(message, item.business_id, model);
      break;

    case 'booking':
      result = await handleBooking(message, item.business_id, model, platform, intentEntities);
      break;

    case 'status':
      result = await handleStatus(message, item.business_id);
      break;

    case 'cancellation':
      result = await handleCancellation(message, item.business_id);
      break;

    case 'reschedule':
      result = await handleReschedule(message, item.business_id, model, platform);
      break;

    case 'complaint':
      result = await handleComplaint(message, item.business_id, model);
      break;

    default: {
      // Check if this is a continuation of a booking conversation
      const conversation = await getActiveConversation(item.business_id, message.chatId);
      if (conversation && conversation.intent === 'booking') {
        console.log('[QUEUE] Continuing booking conversation');
        result = await handleBooking(message, item.business_id, model, platform);
      } else {
        result = await handleUnknown(message, item.business_id, model);
      }
    }
  }

  if (result.success) {
    await markCompleted(item.id, result.response || 'Processed');

    // Route response to the correct platform
    if (platform === 'messenger') {
      await sendResponseToMessenger(
        item.raw_payload,
        result.response || 'Processed',
        item.business_id,
        result.messengerSlots
      );
    } else {
      await sendResponseToTelegram(
        item.raw_payload,
        result.response || 'Processed',
        item.business_id,
        result.keyboard
      );
    }

    console.log('[QUEUE] ✅ Response:', result.response?.substring(0, 50));
  } else {
    await markFailed(item.id, result.error || 'Unknown error');
    console.error('[QUEUE] ❌ Failed:', result.error);
  }
}

async function getActiveConversation(
  businessId: string,
  customerId: string
): Promise<Conversation | null> {
  const supabase = getSupabaseClient();

  const { data } = await (supabase
    .from('conversations') as any)
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_chat_id', customerId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as Conversation | null;
}
/**
 * Get or create conversation
 */
async function getOrCreateConversation(
  businessId: string,
  customerId: string,
  intent: string
): Promise<Conversation> {
  const supabase = getSupabaseClient();

  // Check for active conversation
  const { data: existing } = await (supabase
    .from('conversations') as any)
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_chat_id', customerId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log('[CONVERSATION] Continuing:', (existing as any).id);
    return existing as any as Conversation;
  }

  // Create new conversation
  const { data: created, error } = await (supabase
    .from('conversations') as any)
    .insert({
      business_id: businessId,
      customer_chat_id: customerId,
      intent,
      state: {},
      history: [],
    } as any)
    .select()
    .single();

  if (error || !created) {
    console.error('[CONVERSATION] Failed to create:', error);
    throw new Error('Failed to create conversation');
  }

  console.log('[CONVERSATION] Started new:', (created as any).id);
  return created as any as Conversation;
}

/** Keep only the last N history entries to bound context window size */
const MAX_HISTORY_ENTRIES = 20;

/**
 * Update conversation (trims history to prevent unbounded growth)
 */
async function updateConversation(
  conversationId: string,
  state: any,
  history: any[]
): Promise<void> {
  const supabase = getSupabaseClient();

  const trimmed = history.length > MAX_HISTORY_ENTRIES
    ? history.slice(history.length - MAX_HISTORY_ENTRIES)
    : history;

  await (supabase
    .from('conversations') as any)
    .update({
      state,
      history: trimmed,
      last_message_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq('id', conversationId);
}

/** Log a booking attempt for TCR metric tracking (§7.2) */
async function logBookingAttempt(
  businessId: string,
  conversationId: string,
  chatId: string,
  platform: string,
  success: boolean,
  turns: number,
  failureReason?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  await (supabase.from('booking_attempts') as any).insert({
    business_id: businessId,
    conversation_id: conversationId,
    customer_chat_id: chatId,
    platform,
    success,
    turns_taken: turns,
    failure_reason: failureReason || null,
  });
}



/**
 * Extract message from Telegram payload
 */
function extractMessage(payload: any): { text: string; userId: string; chatId: string } | null {
  const message = payload.message || payload.edited_message;

  if (!message || !message.text) {
    return null;
  }

  return {
    text: message.text,
    userId: message.from?.id?.toString() || 'unknown',
    chatId: message.chat?.id?.toString() || 'unknown',
  };
}

/**
 * Extract message from Messenger payload
 */
function extractMessengerMessage(payload: any): { text: string; userId: string; chatId: string } | null {
  const message = payload.message;

  if (!message || !message.text) {
    return null;
  }

  return {
    text: message.text,
    userId: payload.sender?.id || 'unknown',
    chatId: payload.sender?.id || 'unknown', // For Messenger, sender ID is the chat ID
  };
}

async function markCompleted(itemId: string, response: string): Promise<void> {
  const supabase = getSupabaseClient();
  await (supabase.from('request_queue') as any)
    .update({ status: 'completed', retry_at: null, error_message: null })
    .eq('id', itemId);
}

async function markFailed(itemId: string, error: string): Promise<void> {
  const supabase = getSupabaseClient();
  await (supabase.from('request_queue') as any)
    .update({ status: 'failed', error_message: error })
    .eq('id', itemId);
}

async function sendResponseToTelegram(
  payload: any,
  responseText: string,
  businessId: string,
  keyboard?: InlineKeyboardButton[][]
): Promise<void> {
  try {
    const { sendTelegramMessage, sendTypingAction } = await import('../infrastructure/telegram');

    const message = payload.message || payload.edited_message;
    if (!message) return;

    const chatId = message.chat?.id?.toString();
    const messageId = message.message_id;
    if (!chatId) return;

    const supabase = getSupabaseClient();
    const { data: business } = await (supabase
      .from('businesses') as any)
      .select('telegram_bot_token')
      .eq('id', businessId)
      .single();

    if (!business || !business.telegram_bot_token) {
      console.error('[TELEGRAM] No bot token');
      return;
    }

    await sendTypingAction(business.telegram_bot_token, chatId);
    await new Promise(resolve => setTimeout(resolve, 500));

    const sent = await sendTelegramMessage(business.telegram_bot_token, {
      chatId,
      text: responseText,
      replyToMessageId: messageId,
      parseMode: 'Markdown',
      inlineKeyboard: keyboard,
    });

    if (!sent) {
      console.error('[TELEGRAM] Failed to send');
    }
  } catch (error) {
    console.error('[TELEGRAM] Exception:', error);
  }
}

/**
 * Send response to Messenger user.
 * When messengerSlots is provided, sends quick-reply buttons for slot selection.
 */
async function sendResponseToMessenger(
  payload: any,
  responseText: string,
  businessId: string,
  messengerSlots?: { date: string; slots: string[] }
): Promise<void> {
  try {
    const {
      sendMessengerMessage,
      sendTypingIndicator,
      sendMessengerMessageWithQuickReplies,
      buildMessengerSlotPrompt,
    } = await import('../infrastructure/messenger');

    const senderId = payload.sender?.id;
    if (!senderId) return;

    const supabase = getSupabaseClient();

    const { data: business } = await (supabase
      .from('businesses') as any)
      .select('fb_page_access_token')
      .eq('id', businessId)
      .single();

    if (!business || !business.fb_page_access_token) {
      console.error('[MESSENGER] No page access token found for business:', businessId);
      return;
    }

    await sendTypingIndicator(business.fb_page_access_token, senderId, 'typing_on');
    await new Promise(resolve => setTimeout(resolve, 500));

    if (messengerSlots && messengerSlots.slots.length > 0) {
      // Send the AI text first, then the slot quick-reply buttons
      await sendMessengerMessage(business.fb_page_access_token, {
        recipientId: senderId,
        text: responseText,
        messagingType: 'RESPONSE',
      });
      await sendMessengerMessageWithQuickReplies(
        business.fb_page_access_token,
        senderId,
        buildMessengerSlotPrompt(messengerSlots.date),
        messengerSlots.slots,
        messengerSlots.date
      );
    } else {
      const sent = await sendMessengerMessage(business.fb_page_access_token, {
        recipientId: senderId,
        text: responseText,
        messagingType: 'RESPONSE',
      });
      if (!sent) {
        console.error('[MESSENGER] Failed to send message');
      }
    }

    await sendTypingIndicator(business.fb_page_access_token, senderId, 'typing_off');

  } catch (error) {
    console.error('[MESSENGER] Exception:', error);
  }
}

// ===== HANDLERS =====

async function handleGreeting(
  message: { text: string; userId: string; chatId: string },
  businessId: string
): Promise<ProcessingResult> {
  const supabase = getSupabaseClient();
  const { data: business } = await (supabase.from('businesses') as any)
    .select('name')
    .eq('id', businessId)
    .single();

  const name = business?.name || 'our service';
  return {
    success: true,
    // §8.3 ethics requirement: disclose AI on first message
    response: `Hello! Welcome to *${name}*.\n\n_You are chatting with AutoLeap AI — an automated assistant. A human is available if needed._\n\nHow can I help you today?\n\n• Book an appointment\n• Answer questions about our services\n• Check your booking status`,
    costIncurred: 0,
  };
}

async function handleFAQ(
  message: { text: string; userId: string; chatId: string },
  businessId: string,
  model: string
): Promise<ProcessingResult> {
  const { searchFAQs } = await import('../infrastructure/embeddings');
  const { llm } = await import('../infrastructure/llm-adapter');

  try {
    // Fetch active services + tiers in parallel with FAQ search
    const [relevantFAQs, { data: svcRows }] = await Promise.all([
      searchFAQs(businessId, message.text, 0.6, 3),
      (getSupabaseClient().from('services') as any)
        .select('name, description, duration_minutes, price, currency, tiers')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

    // Build a services pricing block (injected into the FAQ context so the AI
    // can answer pricing questions even if there's no dedicated FAQ for them)
    let servicesPricingBlock = '';
    if (svcRows && svcRows.length > 0) {
      servicesPricingBlock = '\n\nSERVICES & PRICING:\n' +
        (svcRows as any[]).map((s: any) => {
          const cur = s.currency || 'LKR';
          const hasTiers = Array.isArray(s.tiers) && s.tiers.length > 0;
          if (hasTiers) {
            const tierLines = (s.tiers as any[])
              .map((t: any) => `  • ${t.name}: ${cur} ${Number(t.price).toLocaleString()} (${t.duration_minutes ?? s.duration_minutes} min)`)
              .join('\n');
            return `${s.name}:\n${tierLines}`;
          }
          const price = s.price != null ? ` — ${cur} ${Number(s.price).toLocaleString()}` : '';
          return `${s.name}${price} (${s.duration_minutes} min)`;
        }).join('\n');
    }

    if (relevantFAQs.length === 0 && !servicesPricingBlock) {
      return {
        success: true,
        response: "I don't have information about that. Let me connect you with a team member who can help.",
        costIncurred: 0,
      };
    }

    const faqContext = relevantFAQs.length > 0
      ? '\n\nFAQs:\n' + relevantFAQs.map((faq, i) => `[${i + 1}] Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')
      : '';

    const prompt = `You are a helpful assistant for a service business. Answer the customer's question using the provided FAQs and/or services pricing information below.
${faqContext}${servicesPricingBlock}

Customer Question: ${message.text}

Instructions:
- If the customer asks about prices, list ALL relevant packages with their prices clearly.
- Answer briefly and naturally.
- If you cannot find the answer, say you don't have that information.
- Keep response under 150 words.
- Be friendly and professional.`;

    const response = await llm.chat.completions.create({
      model: model as any,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    const answer = response.choices[0].message.content || 'I apologize, I could not generate a response.';

    const tokensIn = response.usage?.prompt_tokens || 0;
    const tokensOut = response.usage?.completion_tokens || 0;
    const cost = calculateActualCost(model as any, tokensIn, tokensOut);

    await commitCost(businessId, cost, model as any, tokensIn, tokensOut);

    return {
      success: true,
      response: answer,
      costIncurred: cost,
    };
  } catch (error) {
    console.error('[FAQ] Handler error:', error);
    return {
      success: false,
      error: 'Failed to process FAQ query',
      costIncurred: 0,
    };
  }
}

async function handleBooking(
  message: { text: string; userId: string; chatId: string },
  businessId: string,
  model: string,
  platform: string = 'telegram',
  entities: Record<string, any> = {}
): Promise<ProcessingResult> {
  console.log('[BOOKING] Starting tool-calling agent...');

  try {
    // Fetch business settings + active services
    const [{ data: bizRow }, { data: serviceRows }] = await Promise.all([
      (getSupabaseClient().from('businesses') as any)
        .select('timezone, bot_name, bot_greeting, bot_tone')
        .eq('id', businessId)
        .single(),
      (getSupabaseClient().from('services') as any)
        .select('name, description, duration_minutes, price, currency, tiers')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);
    const tz       = bizRow?.timezone    ?? 'Asia/Colombo';
    const botName  = bizRow?.bot_name    || 'Assistant';
    const botGreet = bizRow?.bot_greeting || '';
    const botTone  = bizRow?.bot_tone    || 'friendly';

    // Build a human-readable services + pricing menu for the AI prompt
    const servicesMenu = (serviceRows && serviceRows.length > 0)
      ? `\n\nAVAILABLE SERVICES & PRICING:\n` +
        (serviceRows as any[]).map((s: any, i: number) => {
          const currency: string = s.currency || 'LKR';
          const hasTiers = Array.isArray(s.tiers) && s.tiers.length > 0;

          let line = `${i + 1}. **${s.name}**`;
          if (s.description) line += ` — ${s.description}`;

          if (hasTiers) {
            // List each package with name, price, and optional duration override
            line += `\n   Packages:`;
            (s.tiers as any[]).forEach((t: any, ti: number) => {
              const dur = t.duration_minutes ?? s.duration_minutes;
              line += `\n   ${String.fromCharCode(97 + ti)}) ${t.name}: ${currency} ${Number(t.price).toLocaleString()} (${dur} min)`;
            });
            line += `\n   ← Ask the customer to pick one of these packages.`;
          } else {
            // Single price
            if (s.price != null) {
              line += ` | ${currency} ${Number(s.price).toLocaleString()}`;
            }
            line += ` (${s.duration_minutes} min)`;
          }
          return line;
        }).join('\n\n') +
        `\n\nIMPORTANT PRICING RULES:
- If the customer asks about prices or "how much", show the relevant service and its packages.
- If a service has packages, ask the customer to choose a specific package BEFORE proceeding.
- Use the EXACT package name (e.g. "Hydra Cleanup") as the service_type when calling book_appointment.
- Use the package's duration_minutes (not the service default) when calling book_appointment.
- If the customer hasn't specified a service yet, present the full menu first.`
      : '';

    // Get or create conversation
    const conversation = await getOrCreateConversation(businessId, message.chatId, 'booking');

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    const geminiModel = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      tools: calendarToolsForGemini as any,
    });

    // Restore history from conversation
    const chat = geminiModel.startChat({
      history: conversation.history,
    });

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let iterations = 0;
    const maxIterations = 10;

    // Build context-aware prompt
    const isFirstMessage = conversation.history.length === 0;

    let currentMessage = '';

    // Handle slot selection from inline keyboard callback
    if (message.text.startsWith('slot:')) {
      const [, date, time] = message.text.split(':');
      currentMessage = `Customer selected the time slot: ${date} at ${time}. ` +
        `Now ask for their full name and phone number to confirm the booking. ` +
        `State so far: ${JSON.stringify(conversation.state)}`;
      // Pre-fill state with selected slot
      conversation.state.selected_date = date;
      conversation.state.selected_time = time;
    } else if (isFirstMessage) {
      // Build entity hints from LLM classifier to skip redundant questions
      const entityHints: string[] = [];
      if (entities.service) entityHints.push(`Customer already mentioned service: "${entities.service}"`);
      if (entities.date)    entityHints.push(`Customer mentioned date: "${entities.date}"`);
      if (entities.time)    entityHints.push(`Customer mentioned time: "${entities.time}"`);
      const entityContext = entityHints.length ? `\nKNOWN INFO: ${entityHints.join(' | ')}` : '';

      const greeting = botGreet
        ? botGreet.replace('{bot_name}', botName)
        : '';
      const toneInstruction =
        botTone === 'professional' ? 'Be professional and formal.' :
        botTone === 'casual'       ? 'Be casual and relaxed.' :
        'Be warm, friendly and concise.';

      currentMessage =
        `You are ${botName}, a booking assistant for a service business. ${toneInstruction}
ALWAYS respond in the same language the customer writes in (Sinhala, Tamil, English, or any other language).${greeting ? `\nGreeting to use on first contact: "${greeting}"` : ''}${servicesMenu}${entityContext}

Customer message: "${message.text}"

BOOKING WORKFLOW:
1. If the customer asks about prices or services, present the menu with package prices.
2. If a service has multiple packages, ask the customer to choose one before proceeding.
3. Once the service/package is clear, ask for a preferred date (or suggest one).
4. Call get_available_slots(date, service_name) — pass the exact service/tier name.
5. Ask the customer to pick a time slot.
6. Ask for their full name and phone number.
7. Before confirming, ask: "Any special requests or notes for your appointment?" (optional — skip if customer seems in a hurry).
8. Call book_appointment with: date, time, customer_name, customer_phone, service_type, duration, notes (if any), price, currency.

Current date: ${new Date().toLocaleDateString('en-CA', { timeZone: tz })}
Tomorrow: ${new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: tz })}

If known info is listed above, skip asking for those details again.
Accept any valid phone number format.`;
    } else {
      currentMessage = `Customer's new message: "${message.text}"

Continue helping them complete the booking. State: ${JSON.stringify(conversation.state)}`;
    }

    while (iterations < maxIterations) {
      iterations++;
      console.log(`[BOOKING] Turn ${iterations}/${maxIterations}`);

      const result = await chat.sendMessage(currentMessage);
      const response = result.response;

      totalTokensIn += response.usageMetadata?.promptTokenCount || 0;
      totalTokensOut += response.usageMetadata?.candidatesTokenCount || 0;

      // Save to history
      conversation.history.push(
        { role: 'user', parts: [{ text: currentMessage }] },
        { role: 'model', parts: response.candidates?.[0]?.content?.parts || [] }
      );

      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        console.log('[BOOKING] Function calls requested:', functionCalls.length);

        const functionResponses = [];

        let pendingSlotKeyboard: InlineKeyboardButton[][] | undefined;
        let pendingMessengerSlots: { date: string; slots: string[] } | undefined;

      for (const call of functionCalls) {
          console.log(`[TOOL] Executing: ${call.name}`);
          console.log(`[TOOL] Arguments:`, JSON.stringify(call.args, null, 2));

          const toolArgs = { ...call.args } as any;

          // Inject customer_chat_id so appointments can be looked up by chat later
          if (call.name === 'book_appointment') {
            toolArgs.customer_chat_id = message.chatId;
          }

          const toolResult = await executeCalendarTool(call.name, toolArgs, businessId);

          console.log(`[TOOL] Result:`, JSON.stringify(toolResult, null, 2));

          // Build slot-selection UI for the appropriate channel
          if (call.name === 'get_available_slots' && toolResult.available_slots?.length > 0) {
            conversation.state.pending_slots = toolResult.available_slots;
            conversation.state.pending_date = toolArgs.date;
            if (platform === 'messenger') {
              // Messenger uses quick replies instead of inline keyboards
              pendingMessengerSlots = { date: toolArgs.date, slots: toolResult.available_slots };
            } else {
              const { buildSlotKeyboard } = await import('../infrastructure/telegram');
              pendingSlotKeyboard = buildSlotKeyboard(toolResult.available_slots, toolArgs.date);
            }
          }

          // Update conversation state on successful booking + log TCR
          if (call.name === 'book_appointment' && toolResult.success) {
            conversation.state.booked = true;
            conversation.state.appointment = toolResult;
            conversation.state.pending_slots = undefined;
            await logBookingAttempt(businessId, conversation.id, message.chatId, platform, true, iterations);

            // Send booking confirmation email to the business owner
            try {
              const supabase = getSupabaseClient();
              const { data: bizOwner } = await (supabase.from('businesses') as any)
                .select('name, users:user_id (email)')
                .eq('id', businessId)
                .single();
              const ownerEmail = (bizOwner?.users as any)?.email;
              if (ownerEmail) {
                const { sendBookingConfirmationEmail } = await import('../infrastructure/email');
                await sendBookingConfirmationEmail({
                  toEmail: ownerEmail,
                  businessName: bizOwner.name,
                  customerName: toolArgs.customer_name || 'Unknown',
                  customerPhone: toolArgs.customer_phone || 'Unknown',
                  serviceType: toolArgs.service_type || 'Appointment',
                  appointmentDate: toolArgs.date || '',
                  appointmentTime: toolArgs.time || '',
                });
              }
            } catch (emailErr) {
              console.warn('[BOOKING] Email notification failed (non-fatal):', emailErr);
            }
          }
          if (call.name === 'book_appointment' && !toolResult.success) {
            await logBookingAttempt(businessId, conversation.id, message.chatId, platform, false, iterations, toolResult.error);
          }

          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: toolResult,
            },
          });
        }

        currentMessage = '';
        const nextResult = await chat.sendMessage(functionResponses as any);
        totalTokensIn += nextResult.response.usageMetadata?.promptTokenCount || 0;
        totalTokensOut += nextResult.response.usageMetadata?.candidatesTokenCount || 0;

        // Save tool results to history
        conversation.history.push(
          { role: 'function', parts: functionResponses },
          { role: 'model', parts: nextResult.response.candidates?.[0]?.content?.parts || [] }
        );

        const nextFunctionCalls = nextResult.response.functionCalls();
        if (nextFunctionCalls && nextFunctionCalls.length > 0) {
          continue;
        }

        const finalText = nextResult.response.text();

        await updateConversation(conversation.id, conversation.state, conversation.history);

        const cost = calculateActualCost('gemini-flash-latest', totalTokensIn, totalTokensOut);
        await commitCost(businessId, cost, 'gemini-flash-latest', totalTokensIn, totalTokensOut);

        return {
          success: true,
          response: finalText,
          costIncurred: cost,
          keyboard: pendingSlotKeyboard,
          messengerSlots: pendingMessengerSlots,
        };
      }

      // No function calls — just text
      const text = response.text();

      await updateConversation(conversation.id, conversation.state, conversation.history);

      const cost = calculateActualCost('gemini-flash-latest', totalTokensIn, totalTokensOut);
      await commitCost(businessId, cost, 'gemini-flash-latest', totalTokensIn, totalTokensOut);

      return {
        success: true,
        response: text,
        costIncurred: cost,
      };
    }

    console.warn('[BOOKING] Max iterations reached — escalating to owner');
    await updateConversation(conversation.id, conversation.state, conversation.history);
    await logBookingAttempt(businessId, conversation.id, message.chatId, platform, false, maxIterations, 'max_iterations');

    // Notify owner
    const { data: biz } = await (getSupabaseClient().from('businesses') as any)
      .select('telegram_bot_token, owner_telegram_chat_id')
      .eq('id', businessId)
      .single();
    if (biz?.telegram_bot_token && biz?.owner_telegram_chat_id) {
      const { sendOwnerNotification } = await import('../infrastructure/telegram');
      await sendOwnerNotification(
        biz.telegram_bot_token,
        biz.owner_telegram_chat_id,
        `⚠️ *Booking could not be completed*\n\nCustomer (chat: ${message.chatId}) could not finish booking after ${maxIterations} attempts. Please follow up manually.`
      );
    }

    const cost = calculateActualCost('gemini-flash-latest', totalTokensIn, totalTokensOut);
    await commitCost(businessId, cost, 'gemini-flash-latest', totalTokensIn, totalTokensOut);
    return {
      success: true,
      response: "I'm sorry, I wasn't able to complete your booking in this session. Our team has been notified and will get in touch with you shortly to help. You can also reply with your preferred date and we'll start fresh!",
      costIncurred: cost,
    };

  } catch (error: any) {
    console.error('[BOOKING] Handler error:', error);

    return {
      success: false,
      error: 'Failed to process booking request. Please try again.',
      costIncurred: 0,
    };
  }
}

async function handleStatus(
  message: { text: string; userId: string; chatId: string },
  businessId: string
): Promise<ProcessingResult> {
  const supabase = getSupabaseClient();
  const { data: bizTzS } = await (supabase.from('businesses') as any).select('timezone').eq('id', businessId).single();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: bizTzS?.timezone ?? 'Asia/Colombo' });

  // Look up upcoming appointments linked to this chat session
  const { data: appointments } = await (supabase
    .from('appointments') as any)
    .select('customer_name, service_type, appointment_date, appointment_time, status')
    .eq('business_id', businessId)
    .eq('customer_chat_id', message.chatId)
    .gte('appointment_date', today)
    .eq('status', 'scheduled')
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .limit(1);

  if (!appointments || appointments.length === 0) {
    return {
      success: true,
      response: "I couldn't find any upcoming appointments linked to this chat. If you have a booking, please share your phone number and I'll look it up for you.",
      costIncurred: 0,
    };
  }

  const appt = appointments[0];
  const dateStr = new Date(`${appt.appointment_date}T00:00:00`).toLocaleDateString('en-LK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    success: true,
    response: `Your next appointment:\n\n*${appt.service_type}*\n📅 ${dateStr}\n🕐 ${appt.appointment_time}\n\nStatus: ${appt.status === 'scheduled' ? '✅ Confirmed' : appt.status}`,
    costIncurred: 0,
  };
}

async function handleComplaint(
  message: { text: string; userId: string; chatId: string },
  businessId: string,
  model: string
): Promise<ProcessingResult> {
  const supabase = getSupabaseClient();

  // Mark the active conversation as a complaint
  await (supabase.from('conversations') as any)
    .update({ intent: 'complaint', status: 'escalated' })
    .eq('business_id', businessId)
    .eq('customer_chat_id', message.chatId);

  // Notify the owner via Telegram DM + email if configured
  const { data: business } = await (supabase.from('businesses') as any)
    .select('name, telegram_bot_token, owner_telegram_chat_id, users:user_id (email)')
    .eq('id', businessId)
    .single();

  if (business?.telegram_bot_token && business?.owner_telegram_chat_id) {
    const { sendOwnerNotification } = await import('../infrastructure/telegram');
    const ownerMessage =
      `⚠️ *Complaint received*\n\n` +
      `Customer (chat: ${message.chatId}) reported:\n_"${message.text}"_\n\n` +
      `Please follow up as soon as possible.`;
    await sendOwnerNotification(
      business.telegram_bot_token,
      business.owner_telegram_chat_id,
      ownerMessage
    );
    console.log('[COMPLAINT] ✅ Owner notified via Telegram DM');
  }

  // Send complaint alert email to owner
  const ownerEmail = (business?.users as any)?.email;
  if (ownerEmail) {
    try {
      const { sendComplaintAlertEmail } = await import('../infrastructure/email');
      await sendComplaintAlertEmail({
        toEmail: ownerEmail,
        businessName: business.name,
        customerChatId: message.chatId,
        platform: 'telegram',
        messageText: message.text,
      });
    } catch (emailErr) {
      console.warn('[COMPLAINT] Email notification failed (non-fatal):', emailErr);
    }
  }

  return {
    success: true,
    response:
      "I'm sorry to hear you're having an issue. Your complaint has been escalated to the team and someone will reach out to you shortly. We apologize for any inconvenience.",
    costIncurred: 0,
  };
}

/**
 * Handle booking cancellation requests.
 * Looks up the customer's most recent upcoming appointment by chat ID,
 * cancels it on Google Calendar, and updates the DB record.
 */
async function handleCancellation(
  message: { text: string; userId: string; chatId: string },
  businessId: string
): Promise<ProcessingResult> {
  const supabase = getSupabaseClient();
  const { data: bizTzC } = await (supabase.from('businesses') as any)
    .select('timezone, cancellation_window_hours')
    .eq('id', businessId)
    .single();
  const tz = bizTzC?.timezone ?? 'Asia/Colombo';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

  // Find the customer's most recent upcoming appointment
  const { data: appointment } = await (supabase
    .from('appointments') as any)
    .select('id, customer_name, service_type, appointment_date, appointment_time, google_event_id, status')
    .eq('business_id', businessId)
    .eq('customer_chat_id', message.chatId)
    .eq('status', 'scheduled')
    .gte('appointment_date', today)
    .order('appointment_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!appointment) {
    return {
      success: true,
      response: "I couldn't find any upcoming appointments linked to this chat. If you believe this is an error, please contact us directly.",
      costIncurred: 0,
    };
  }

  // ── Cancellation grace-period check ──────────────────────────────────────
  const windowHours: number = bizTzC?.cancellation_window_hours ?? 0;
  if (windowHours > 0) {
    // Build a Date from the appointment's date + time in the business timezone
    const apptDateTimeStr = `${appointment.appointment_date}T${appointment.appointment_time}`;
    // Parse as local date in the business timezone
    const apptEpoch = new Date(apptDateTimeStr).getTime();
    const nowEpoch = Date.now();
    const hoursUntilAppt = (apptEpoch - nowEpoch) / 3_600_000;

    if (hoursUntilAppt >= 0 && hoursUntilAppt < windowHours) {
      return {
        success: true,
        response:
          `I'm sorry, but cancellations must be made at least **${windowHours} hour${windowHours !== 1 ? 's' : ''}** before the appointment. ` +
          `Your appointment is in approximately ${Math.ceil(hoursUntilAppt)} hour(s), so it can no longer be cancelled online. ` +
          `Please contact us directly for assistance.`,
        costIncurred: 0,
      };
    }
  }

  // Cancel on Google Calendar if an event ID is stored
  if (appointment.google_event_id) {
    const { cancelAppointment } = await import('../infrastructure/calendar');
    await cancelAppointment(businessId, appointment.google_event_id);
  }

  // Mark appointment as cancelled in the database
  await (supabase
    .from('appointments') as any)
    .update({ status: 'cancelled' })
    .eq('id', appointment.id);

  // Reset the conversation booking state
  await (supabase
    .from('conversations') as any)
    .update({ state: {}, intent: 'cancellation' })
    .eq('business_id', businessId)
    .eq('customer_chat_id', message.chatId);

  console.log('[CANCEL] ✅ Appointment cancelled:', appointment.id);

  // ── Waitlist: notify next person waiting for this service ────────────────
  try {
    const { data: nextWaiting } = await (supabase
      .from('waitlist') as any)
      .select('id, customer_chat_id, platform, customer_name')
      .eq('business_id', businessId)
      .eq('service_type', appointment.service_type)
      .is('notified_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextWaiting) {
      // Mark them as notified
      await (supabase.from('waitlist') as any)
        .update({ notified_at: new Date().toISOString() })
        .eq('id', nextWaiting.id);

      const waitlistMsg =
        `🎉 Great news! A slot just opened up for *${appointment.service_type}* ` +
        `on *${appointment.appointment_date}* at *${appointment.appointment_time}*. ` +
        `You were on the waitlist — reply here to confirm your booking before this slot is taken!`;

      if (nextWaiting.platform === 'telegram') {
        const { data: biz2 } = await (supabase.from('businesses') as any)
          .select('telegram_bot_token')
          .eq('id', businessId)
          .single();
        if (biz2?.telegram_bot_token) {
          const { sendTelegramMessage } = await import('../infrastructure/telegram');
          await sendTelegramMessage(biz2.telegram_bot_token, {
            chatId: nextWaiting.customer_chat_id,
            text: waitlistMsg,
            parseMode: 'Markdown',
          });
        }
      }
      console.log('[CANCEL] ✅ Waitlist notified:', nextWaiting.customer_chat_id);
    }
  } catch (wlErr) {
    console.warn('[CANCEL] Waitlist notification failed (non-fatal):', wlErr);
  }

  // Notify the business owner via Telegram DM + email
  try {
    const { data: biz } = await (supabase.from('businesses') as any)
      .select('name, telegram_bot_token, owner_telegram_chat_id, users:user_id (email)')
      .eq('id', businessId)
      .single();

    if (biz?.telegram_bot_token && biz?.owner_telegram_chat_id) {
      const { sendOwnerNotification } = await import('../infrastructure/telegram');
      await sendOwnerNotification(
        biz.telegram_bot_token,
        biz.owner_telegram_chat_id,
        `📅 *Booking Cancelled*\n\n` +
        `Customer (chat: ${message.chatId}) cancelled their appointment:\n\n` +
        `• *Service:* ${appointment.service_type}\n` +
        `• *Date:* ${appointment.appointment_date}\n` +
        `• *Time:* ${appointment.appointment_time}\n\n` +
        `The calendar event has been removed.`
      );
    }

    const ownerEmail = (biz?.users as any)?.email;
    if (ownerEmail && biz?.name) {
      const { sendCancellationAlertEmail } = await import('../infrastructure/email');
      await sendCancellationAlertEmail({
        toEmail: ownerEmail,
        businessName: biz.name,
        customerChatId: message.chatId,
        serviceType: appointment.service_type,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.appointment_time,
      });
    }
  } catch (notifyErr) {
    console.warn('[CANCEL] Owner notification failed (non-fatal):', notifyErr);
  }

  return {
    success: true,
    response: `Your appointment for **${appointment.service_type}** on ${appointment.appointment_date} at ${appointment.appointment_time} has been successfully cancelled. If you'd like to rebook, just let me know!`,
    costIncurred: 0,
  };
}

/**
 * Handle appointment rescheduling:
 * 1. Find and cancel the customer's current appointment
 * 2. Transition into the booking flow so they can pick a new slot
 */
async function handleReschedule(
  message: { text: string; userId: string; chatId: string },
  businessId: string,
  model: string,
  platform: string
): Promise<ProcessingResult> {
  const supabase = getSupabaseClient();
  const { data: bizTzR } = await (supabase.from('businesses') as any)
    .select('timezone, bot_name, bot_greeting, bot_tone')
    .eq('id', businessId)
    .single();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: bizTzR?.timezone ?? 'Asia/Colombo' });

  // Find the customer's current upcoming appointment
  const { data: appointment } = await (supabase
    .from('appointments') as any)
    .select('id, customer_name, service_type, appointment_date, appointment_time, duration_minutes, status')
    .eq('business_id', businessId)
    .eq('customer_chat_id', message.chatId)
    .eq('status', 'scheduled')
    .gte('appointment_date', today)
    .order('appointment_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!appointment) {
    return {
      success: true,
      response: "I couldn't find any upcoming appointments linked to this chat. Would you like to book a new appointment instead?",
      costIncurred: 0,
    };
  }

  // Keep the existing appointment and route into a rescheduling booking flow
  // The booking agent is given the appointment_id and instructed to use reschedule_appointment
  const conversation = await getOrCreateConversation(businessId, message.chatId, 'booking');
  conversation.state.rescheduling     = true;
  conversation.state.appointment_id   = appointment.id;
  conversation.state.original_service = appointment.service_type;

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    tools: calendarToolsForGemini as any,
  });
  const chat = geminiModel.startChat({ history: conversation.history });

  const tz = bizTzR?.timezone ?? 'Asia/Colombo';
  const botName = bizTzR?.bot_name || 'Assistant';

  const reschedulePrompt =
    `You are ${botName}, a friendly booking assistant.

The customer wants to reschedule their existing appointment:
- Service: ${appointment.service_type}
- Current date: ${appointment.appointment_date} at ${appointment.appointment_time}
- Appointment ID: ${appointment.id}

RESCHEDULING WORKFLOW:
1. Ask the customer for their preferred NEW date.
2. Call get_available_slots(date, service_name="${appointment.service_type}") to show available times.
3. Ask the customer to pick a time slot.
4. Call reschedule_appointment(new_date, new_time, appointment_id="${appointment.id}").
   This patches the existing booking — do NOT call book_appointment.
5. Confirm the new date/time to the customer.

Today is: ${new Date().toLocaleDateString('en-CA', { timeZone: tz })}
Tomorrow: ${new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: tz })}

Customer message: "${message.text}"`;

  let totalTokensIn = 0, totalTokensOut = 0, iterations = 0;
  const maxIterations = 10;
  let currentMessage = reschedulePrompt;

  while (iterations < maxIterations) {
    iterations++;
    const result = await chat.sendMessage(currentMessage);
    const response = result.response;
    totalTokensIn  += response.usageMetadata?.promptTokenCount    || 0;
    totalTokensOut += response.usageMetadata?.candidatesTokenCount || 0;

    conversation.history.push(
      { role: 'user',  parts: [{ text: currentMessage }] },
      { role: 'model', parts: response.candidates?.[0]?.content?.parts || [] }
    );

    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const functionResponses = [];
      let pendingSlotKeyboard: any;
      let pendingMessengerSlots: any;

      for (const call of functionCalls) {
        const toolArgs = { ...call.args } as any;
        if (call.name === 'reschedule_appointment') {
          toolArgs.appointment_id = appointment.id;
        }
        const toolResult = await executeCalendarTool(call.name, toolArgs, businessId);

        if (call.name === 'get_available_slots' && toolResult.available_slots?.length > 0) {
          conversation.state.pending_slots = toolResult.available_slots;
          conversation.state.pending_date  = toolArgs.date;
          if (platform === 'messenger') {
            pendingMessengerSlots = { date: toolArgs.date, slots: toolResult.available_slots };
          } else {
            const { buildSlotKeyboard } = await import('../infrastructure/telegram');
            pendingSlotKeyboard = buildSlotKeyboard(toolResult.available_slots, toolArgs.date);
          }
        }

        if (call.name === 'reschedule_appointment' && toolResult.success) {
          conversation.state.rescheduling = false;
        }

        functionResponses.push({ functionResponse: { name: call.name, response: toolResult } });
      }

      await updateConversation(conversation.id, conversation.state, conversation.history);
      currentMessage = { functionResponse: functionResponses } as any;
      continue;
    }

    const textResponse = response.text();
    if (textResponse) {
      await updateConversation(conversation.id, conversation.state, conversation.history);
      const cost = calculateActualCost('gemini-flash-latest' as any, totalTokensIn, totalTokensOut);
      await commitCost(businessId, cost, 'gemini-flash-latest' as any, totalTokensIn, totalTokensOut);

      if (platform === 'messenger') {
        return { success: true, response: textResponse, costIncurred: cost };
      }
      return { success: true, response: textResponse, costIncurred: cost };
    }
    break;
  }

  return { success: true, response: "I'm having trouble processing that. Please try again.", costIncurred: 0 };
}

async function handleUnknown(
  message: { text: string; userId: string; chatId: string },
  businessId: string,
  model: string
): Promise<ProcessingResult> {
  // Try semantic search first — the intent classifier may have missed an FAQ
  const { searchFAQs } = await import('../infrastructure/embeddings');
  const hits = await searchFAQs(businessId, message.text, 0.5, 3);

  if (hits.length > 0) {
    // Re-use the FAQ handler path
    return handleFAQ(message, businessId, model);
  }

  // Fallback: ask Gemini to respond helpfully
  try {
    const { llm } = await import('../infrastructure/llm-adapter');
    const prompt =
      `You are a helpful assistant for a local Sri Lankan service business. ` +
      `The customer sent a message that doesn't clearly match booking or FAQ topics.\n\n` +
      `Customer message: "${message.text}"\n\n` +
      `Respond helpfully in 1-2 sentences. If unsure, let them know you can help with ` +
      `booking appointments and answering service questions, and ask them to clarify.`;

    const response = await llm.chat.completions.create({
      model: model as any,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.5,
    });

    const text = response.choices[0].message.content || "I'm not sure I understood that. I can help you book an appointment or answer questions about our services — please let me know what you need!";
    const tokensIn = response.usage?.prompt_tokens || 0;
    const tokensOut = response.usage?.completion_tokens || 0;
    const cost = calculateActualCost(model as any, tokensIn, tokensOut);
    await commitCost(businessId, cost, model as any, tokensIn, tokensOut);

    return { success: true, response: text, costIncurred: cost };
  } catch {
    return {
      success: true,
      response: "I'm not sure I understood that. I can help you book an appointment or answer questions about our services — please let me know what you need!",
      costIncurred: 0,
    };
  }
}