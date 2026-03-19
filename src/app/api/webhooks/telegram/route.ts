import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

// 1. FORCE EDGE RUNTIME
// This makes the function start instantly (0ms) and cost almost nothing.
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // 2. SECURITY: WEBHOOK SECRET CHECK
    // Compares against TELEGRAM_WEBHOOK_SECRET (a separate value from the bot token).
    // Set this in .env.local and pass it as secret_token when calling setWebhook.
    // If TELEGRAM_WEBHOOK_SECRET is not set, the check is skipped (open webhook).
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secretToken !== webhookSecret) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }

    // 3. SIZE CHECK (DDoS Protection)
    // Reject massive payloads (Telegram text is rarely > 8KB)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 8192) {
      return new NextResponse(JSON.stringify({ error: 'Payload Too Large' }), { status: 413 });
    }

    // 4. PARSE DATA
    const body = await req.json();

    // Handle inline keyboard button presses (callback_query)
    if (body.callback_query) {
      const cq = body.callback_query;
      const data: string = cq.data || '';

      // Only handle slot selections
      if (data.startsWith('slot:')) {
        const [, date, time] = data.split(':');
        const supabase = getSupabaseClient();

        // Enqueue as a synthetic booking message
        await (supabase.from('request_queue') as any).insert({
          business_id: process.env.DEFAULT_BUSINESS_ID,
          raw_payload: {
            // Mimic a normal Telegram message payload
            message: {
              text: `slot:${date}:${time}`,
              from: cq.from,
              chat: cq.message?.chat,
              message_id: cq.message?.message_id,
            },
          },
          status: 'pending',
        });

        // Answer the callback to remove the loading spinner on the button
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken) {
          fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id, text: `Selected: ${time}` }),
          }).catch(() => {});
        }

        // Trigger queue processor
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';
        fetch(`${baseUrl}/api/cron/process-queue?key=${cronSecret}`).catch(() => {});
      }

      return new NextResponse('OK');
    }

    // Ignore updates that aren't messages (like typing indicators)
    if (!body.message && !body.edited_message) {
      return new NextResponse('OK');
    }

    // 5. DATABASE INGESTION (The "Air Gap")
    // We send the data to Supabase. We do NOT call OpenAI here.
    const supabase = getSupabaseClient();

    const { error } = await (supabase
      .from('request_queue') as any)
      .insert({
        business_id: process.env.DEFAULT_BUSINESS_ID, // Temporary ID from .env
        raw_payload: body,
        status: 'pending'
      });

    if (error) {
      console.error('Queue Error:', error);
      // We still return 200 to Telegram so it doesn't keep retrying
      return new NextResponse('Database Error', { status: 200 });
    }

    // Trigger queue processor immediately (fire-and-forget — don't await)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';
    fetch(`${baseUrl}/api/cron/process-queue?key=${cronSecret}`)
      .catch(err => console.warn('[TELEGRAM WEBHOOK] Failed to trigger queue processor:', err));

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}