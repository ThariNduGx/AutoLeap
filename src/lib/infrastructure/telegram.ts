/**
 * Telegram Bot API Client
 * Handles sending messages back to users
 */

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface TelegramMessage {
  chatId: string;
  text: string;
  replyToMessageId?: number;
  parseMode?: 'Markdown' | 'HTML';
  inlineKeyboard?: InlineKeyboardButton[][];
}

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

/**
 * Send a message to a Telegram user
 */
export async function sendTelegramMessage(
  botToken: string,
  message: TelegramMessage
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    console.log('[TELEGRAM] Sending message to chat:', message.chatId);

    const body: any = {
      chat_id: message.chatId,
      text: message.text,
      parse_mode: message.parseMode || 'Markdown',
    };

    // Only add reply_to_message_id if it's provided
    // Don't use it for simulated messages
    if (message.replyToMessageId && message.replyToMessageId < 1000) {
      body.reply_to_message_id = message.replyToMessageId;
    }

    if (message.inlineKeyboard && message.inlineKeyboard.length > 0) {
      body.reply_markup = { inline_keyboard: message.inlineKeyboard };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: TelegramResponse = await response.json();

    if (!data.ok) {
      console.error('[TELEGRAM] Failed to send:', data.description);
      return false;
    }

    console.log('[TELEGRAM] ✅ Message sent successfully');
    return true;
  } catch (error) {
    console.error('[TELEGRAM] Exception during send:', error);
    return false;
  }
}

/**
 * Send a typing action (shows "typing..." indicator)
 */
export async function sendTypingAction(
  botToken: string,
  chatId: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendChatAction`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing',
      }),
    });
  } catch (error) {
    // Don't fail if typing action fails - it's just UX enhancement
    console.warn('[TELEGRAM] Typing action failed:', error);
  }
}

/**
 * Get bot information (for verification)
 */
export async function getBotInfo(botToken: string): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/getMe`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('[TELEGRAM] Failed to get bot info:', error);
    return null;
  }
}

/**
 * Format message with Markdown
 */
export function formatMarkdown(text: string): string {
  // Escape special Markdown characters except *, _, `, [
  return text
    .replace(/([\\#\-+=|{}!()])/g, '\\$1');
}

/**
 * Send a message with an inline keyboard to a Telegram chat
 */
export async function sendTelegramMessageWithKeyboard(
  botToken: string,
  chatId: string,
  text: string,
  keyboard: InlineKeyboardButton[][]
): Promise<boolean> {
  return sendTelegramMessage(botToken, { chatId, text, inlineKeyboard: keyboard });
}

/**
 * Answer a Telegram callback query (removes the loading spinner on the button)
 */
export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (error) {
    console.warn('[TELEGRAM] answerCallbackQuery failed:', error);
  }
}

/**
 * Send a direct notification to the business owner
 */
export async function sendOwnerNotification(
  botToken: string,
  ownerChatId: string,
  message: string
): Promise<boolean> {
  return sendTelegramMessage(botToken, { chatId: ownerChatId, text: message });
}

/**
 * Build a 2-column inline keyboard from a list of time slot strings
 * callback_data format: "slot:{date}:{time}"
 */
export function buildSlotKeyboard(
  slots: string[],
  date: string
): InlineKeyboardButton[][] {
  const keyboard: InlineKeyboardButton[][] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const row: InlineKeyboardButton[] = [
      { text: slots[i], callback_data: `slot:${date}:${slots[i]}` },
    ];
    if (slots[i + 1]) {
      row.push({ text: slots[i + 1], callback_data: `slot:${date}:${slots[i + 1]}` });
    }
    keyboard.push(row);
  }
  return keyboard;
}

/**
 * Split long messages (Telegram has 4096 char limit)
 */
export function splitLongMessage(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';

  // Split by newlines first
  const lines = text.split('\n');

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? '\n' : '') + line;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}