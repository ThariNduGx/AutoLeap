// src/lib/core/queue-processor.ts

import { getSupabaseClient } from '../infrastructure/supabase';
import { classifyIntent, selectModel } from './smart-router';
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
  const intent = isSlotCallback ? 'booking' : classifyIntent(message.text);

  // Skip AI if this conversation has been handed to a human
  const activeConv = await getActiveConversation(item.business_id, message.chatId);
  if (activeConv && (activeConv as any).status === 'human') {
    console.log('[QUEUE] Conversation is in human mode — skipping AI');
    await markCompleted(item.id, 'human_mode');
    return;
  }
  const model = selectModel(intent);

  console.log('[QUEUE] Intent:', intent, '| Model:', model);

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
      result = await handleBooking(message, item.business_id, model, platform);
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
    const relevantFAQs = await searchFAQs(businessId, message.text, 0.6, 3);

    if (relevantFAQs.length === 0) {
      return {
        success: true,
        response: "I don't have information about that. Let me connect you with a team member who can help.",
        costIncurred: 0,
      };
    }

    const context = relevantFAQs
      .map((faq, i) => `[${i + 1}] Q: ${faq.question}\nA: ${faq.answer}`)
      .join('\n\n');

    const prompt = `You are a helpful assistant for a service business. Answer the customer's question using ONLY the provided FAQs. If the answer isn't in the FAQs, say you don't know.

FAQs:
${context}

Customer Question: ${message.text}

Instructions:
- Answer briefly and naturally
- Cite the FAQ number if relevant
- Keep response under 100 words
- Be friendly and professional`;

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
  platform: string = 'telegram'
): Promise<ProcessingResult> {
  console.log('[BOOKING] Starting tool-calling agent...');

  try {
    // Fetch business timezone for date/time context
    const { data: bizTz } = await (getSupabaseClient().from('businesses') as any)
      .select('timezone')
      .eq('id', businessId)
      .single();
    const tz = bizTz?.timezone ?? 'Asia/Colombo';

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
      currentMessage = `You are a booking assistant for a Sri Lankan service business.

Customer message: "${message.text}"

WORKFLOW:
1. Extract info from message (service, date, time, name, phone)
2. If you have a date, call get_available_slots to check availability
3. The system will show available slots as buttons — just ask the customer to pick one
4. Once a slot is picked, ask for name and phone number
5. Call book_appointment when you have: date, time, customer_name, customer_phone, service_type

Current date: ${new Date().toLocaleDateString('en-CA', { timeZone: tz })}
Tomorrow: ${new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: tz })}

Start by checking availability if you can determine the date. Accept any valid phone number format.`;
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
  const { data: bizTzC } = await (supabase.from('businesses') as any).select('timezone').eq('id', businessId).single();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: bizTzC?.timezone ?? 'Asia/Colombo' });

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
  const { data: bizTzR } = await (supabase.from('businesses') as any).select('timezone').eq('id', businessId).single();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: bizTzR?.timezone ?? 'Asia/Colombo' });

  // Find the customer's current upcoming appointment
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
      response: "I couldn't find any upcoming appointments linked to this chat to reschedule. Would you like to book a new appointment instead?",
      costIncurred: 0,
    };
  }

  // Cancel the existing appointment
  if (appointment.google_event_id) {
    const { cancelAppointment } = await import('../infrastructure/calendar');
    await cancelAppointment(businessId, appointment.google_event_id);
  }
  await (supabase.from('appointments') as any)
    .update({ status: 'cancelled' })
    .eq('id', appointment.id);

  // Reset conversation state so the booking flow starts fresh
  await (supabase.from('conversations') as any)
    .update({ state: { rescheduling: true, original_service: appointment.service_type }, intent: 'booking' })
    .eq('business_id', businessId)
    .eq('customer_chat_id', message.chatId);

  console.log('[RESCHEDULE] ✅ Old appointment cancelled, routing to booking flow');

  // Synthesise a new message to feed into the booking handler
  const rebookMessage = {
    ...message,
    text: `I want to reschedule my ${appointment.service_type} appointment`,
  };

  return handleBooking(rebookMessage, businessId, model, platform);
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