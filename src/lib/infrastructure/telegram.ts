/**
 * Telegram Bot API Client
 * Handles sending messages back to users
 */

interface TelegramMessage {
  chatId: string;
  text: string;
  replyToMessageId?: number;
  parseMode?: 'Markdown' | 'HTML';
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