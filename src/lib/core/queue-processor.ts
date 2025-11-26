// src/lib/core/queue-processor.ts

import { getSupabaseClient } from '../infrastructure/supabase';
import { classifyIntent, selectModel } from './smart-router';
import { estimateCost, requestBudget, calculateActualCost, commitCost } from '../infrastructure/cost-tracker';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calendarToolsForGemini, executeCalendarTool } from './tools/calendar-tools';

interface QueueItem {
  id: string;
  business_id: string;
  raw_payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

interface ProcessingResult {
  success: boolean;
  response?: string;
  error?: string;
  costIncurred: number;
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
 */
export async function processQueue(batchSize: number = 10): Promise<number> {
  const supabase = getSupabaseClient();
  
  console.log('[QUEUE] Starting batch processing...');

  const { data: items, error: fetchError } = await supabase
    .from('request_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (fetchError) {
    console.error('[QUEUE] Failed to fetch items:', fetchError);
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
      
      await (supabase.from('request_queue') as any)
        .update({ status: 'failed' })
        .eq('id', item.id);
    }
  }

  console.log(`[QUEUE] ✅ Processed ${processedCount}/${items.length} items`);
  return processedCount;
}

/**
 * Process a single queue item.
 */
async function processItem(item: QueueItem): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: updateError } = await (supabase.from('request_queue') as any)
    .update({ status: 'processing' })
    .eq('id', item.id)
    .eq('status', 'pending');

  if (updateError) {
    console.error('[QUEUE] Failed to mark as processing:', updateError);
    return;
  }

  console.log('[QUEUE] Processing item:', item.id);

  const message = extractMessage(item.raw_payload);
  if (!message) {
    console.warn('[QUEUE] No message found in payload:', item.id);
    await markCompleted(item.id, 'No message found');
    return;
  }

  console.log('[QUEUE] Message:', message.text.substring(0, 50));

  const intent = classifyIntent(message.text);
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
      result = await handleBooking(message, item.business_id, model);
      break;
    
    case 'status':
      result = await handleStatus(message, item.business_id);
      break;
    
    case 'complaint':
      result = await handleComplaint(message, item.business_id, model);
      break;
    
    default:
      // Check if this is a continuation of a booking conversation
      const conversation = await getActiveConversation(item.business_id, message.chatId);
      if (conversation && conversation.intent === 'booking') {
        console.log('[QUEUE] Continuing booking conversation');
        result = await handleBooking(message, item.business_id, model);
      } else {
        result = await handleUnknown(message, item.business_id, model);
      }
  }

  if (result.success) {
    await markCompleted(item.id, result.response || 'Processed');
    await sendResponseToTelegram(item.raw_payload, result.response || 'Processed', item.business_id);
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
    .from('conversations')
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_chat_id', customerId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as any);
  
  return data as Conversation | null;
}
/**
 * Get or create conversation
 */
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
  const { data: existing } = await supabase
    .from('conversations')
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
  const { data: created, error } = await supabase
    .from('conversations')
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

/**
 * Update conversation
 */
/**
 * Update conversation
 */
async function updateConversation(
  conversationId: string,
  state: any,
  history: any[]
): Promise<void> {
  const supabase = getSupabaseClient();
  
  await (supabase
    .from('conversations')
    .update({
      state,
      history,
      last_message_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq('id', conversationId) as any);
}



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

async function markCompleted(itemId: string, response: string): Promise<void> {
  const supabase = getSupabaseClient();
  await (supabase.from('request_queue') as any).update({ status: 'completed' }).eq('id', itemId);
}

async function markFailed(itemId: string, error: string): Promise<void> {
  const supabase = getSupabaseClient();
  await (supabase.from('request_queue') as any).update({ status: 'failed' }).eq('id', itemId);
}

async function sendResponseToTelegram(
  payload: any,
  responseText: string,
  businessId: string
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
      .from('businesses')
      .select('telegram_bot_token')
      .eq('id', businessId)
      .single() as any);

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
    });

    if (!sent) {
      console.error('[TELEGRAM] Failed to send');
    }
  } catch (error) {
    console.error('[TELEGRAM] Exception:', error);
  }
}

// ===== HANDLERS =====

async function handleGreeting(
  message: { text: string; userId: string; chatId: string },
  businessId: string
): Promise<ProcessingResult> {
  return {
    success: true,
    response: 'Hello! How can I help you today?',
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
    const relevantFAQs = await searchFAQs(businessId, message.text, 0.7, 3);

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
  model: string
): Promise<ProcessingResult> {
  console.log('[BOOKING] Starting tool-calling agent...');

  try {
    // Get or create conversation
    const conversation = await getOrCreateConversation(businessId, message.chatId, 'booking');

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    
    const geminiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: calendarToolsForGemini as any,
    });

    // Restore history from conversation
    const chat = geminiModel.startChat({
      history: conversation.history,
    });

    let totalTokens = 0;
    let iterations = 0;
    const maxIterations = 5;

    // Build context-aware prompt
    const isFirstMessage = conversation.history.length === 0;
    
    let currentMessage = '';
    if (isFirstMessage) {
      currentMessage = `You are a booking assistant for a Sri Lankan service business.

Customer message: "${message.text}"

WORKFLOW:
1. Extract info from message (service, date, time, name, phone)
2. If you have a date, call get_available_slots to check availability
3. If customer has picked a time and provided name+phone, call book_appointment
4. If info is missing, ask politely (specify format: phone must be 10 digits like 0771234567)

Current date: ${new Date().toISOString().split('T')[0]}
Tomorrow: ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}

Start by checking availability if you can determine the date.`;
    } else {
      // Continuing conversation
      currentMessage = `Customer's new message: "${message.text}"

Continue helping them complete the booking. State: ${JSON.stringify(conversation.state)}`;
    }

    while (iterations < maxIterations) {
      iterations++;
      console.log(`[BOOKING] Turn ${iterations}/${maxIterations}`);

      const result = await chat.sendMessage(currentMessage);
      const response = result.response;
      
      totalTokens += response.usageMetadata?.totalTokenCount || 0;

      // Save to history
      conversation.history.push(
        { role: 'user', parts: [{ text: currentMessage }] },
        { role: 'model', parts: response.candidates?.[0]?.content?.parts || [] }
      );

      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        console.log('[BOOKING] Function calls requested:', functionCalls.length);

        const functionResponses = [];

        for (const call of functionCalls) {
          console.log(`[TOOL] Executing: ${call.name}`);
          console.log(`[TOOL] Arguments:`, JSON.stringify(call.args, null, 2));
          
          const toolResult = await executeCalendarTool(
            call.name,
            call.args,
            businessId
          );

          console.log(`[TOOL] Result:`, JSON.stringify(toolResult, null, 2));

          // Update conversation state
          if (call.name === 'book_appointment' && toolResult.success) {
            conversation.state.booked = true;
            conversation.state.appointment = toolResult;
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
        totalTokens += nextResult.response.usageMetadata?.totalTokenCount || 0;

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
        
        // Save conversation
        await updateConversation(conversation.id, conversation.state, conversation.history);
        
        const cost = 0;
        await commitCost(businessId, cost, 'gemini-2.5-flash', totalTokens, 0);

        return {
          success: true,
          response: finalText,
          costIncurred: cost,
        };
      }

      // No function calls - just text
      const text = response.text();

      // Save conversation
      await updateConversation(conversation.id, conversation.state, conversation.history);

      const cost = 0;
      await commitCost(businessId, cost, 'gemini-2.5-flash', totalTokens, 0);

      return {
        success: true,
        response: text,
        costIncurred: cost,
      };
    }

    console.warn('[BOOKING] Max iterations reached');
    return {
      success: true,
      response: 'To complete your booking, please provide all details in one message: service, date, time, your name, and phone (10 digits).',
      costIncurred: 0,
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
  return {
    success: true,
    response: 'Status handler - coming soon',
    costIncurred: 0,
  };
}

async function handleComplaint(
  message: { text: string; userId: string; chatId: string },
  businessId: string,
  model: string
): Promise<ProcessingResult> {
  return {
    success: true,
    response: 'Your complaint has been escalated to our team. We will contact you shortly.',
    costIncurred: 0,
  };
}

async function handleUnknown(
  message: { text: string; userId: string; chatId: string },
  businessId: string,
  model: string
): Promise<ProcessingResult> {
  return {
    success: true,
    response: 'I apologize, but I did not understand your request. Could you please rephrase?',
    costIncurred: 0,
  };
}