import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

// Edge runtime for zero cold-start latency
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // 1. SECURITY: validate per-business webhook secret
    const incomingSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!incomingSecret) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. SIZE CHECK (DDoS protection)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 8192) {
      return new NextResponse('Payload Too Large', { status: 413 });
    }

    // 3. PARSE BODY
    const body = await req.json();

    // 4. LOOK UP BUSINESS by per-business webhook secret
    const supabase = getSupabaseClient();
    const { data: business, error: bizError } = await (supabase
      .from('businesses') as any)
      .select('id, telegram_bot_token')
      .eq('telegram_webhook_secret', incomingSecret)
      .single();

    if (bizError || !business) {
      console.error('[TELEGRAM WEBHOOK] Unknown secret — no matching business');
      // Return 200 so Telegram doesn't retry (prevents enumeration)
      return new NextResponse('OK', { status: 200 });
    }

    const businessId = business.id;
    const botToken: string = business.telegram_bot_token;

    // 5. HANDLE CALLBACK QUERY (inline keyboard button press)
    if (body.callback_query) {
      const cq = body.callback_query;
      const data: string = cq.data || '';

      if (data.startsWith('slot:')) {
        const parts = data.split(':');
        const date = parts[1];
        const time = parts[2];

        // Enqueue as synthetic booking continuation
        await (supabase.from('request_queue') as any).insert({
          business_id: businessId,
          raw_payload: {
            message: {
              text: `slot:${date}:${time}`,
              from: cq.from,
              chat: cq.message?.chat,
              message_id: cq.message?.message_id,
            },
          },
          status: 'pending',
        });

        // Answer callback to remove spinner (use the business's own bot token)
        fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cq.id, text: `Selected: ${time}` }),
        }).catch(() => {});
      }

      triggerQueue();
      return new NextResponse('OK', { status: 200 });
    }

    // 6. IGNORE non-message updates
    if (!body.message && !body.edited_message) {
      return new NextResponse('OK', { status: 200 });
    }

    // 7. ENQUEUE MESSAGE
    const { error } = await (supabase
      .from('request_queue') as any)
      .insert({
        business_id: businessId,
        raw_payload: body,
        status: 'pending',
      });

    if (error) {
      console.error('[TELEGRAM WEBHOOK] Queue error:', error);
      // Still return 200 so Telegram doesn't retry
      return new NextResponse('OK', { status: 200 });
    }

    triggerQueue();
    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('[TELEGRAM WEBHOOK] Error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}

function triggerQueue() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) return;
  fetch(`${baseUrl}/api/cron/process-queue?key=${cronSecret}`)
    .catch(() => {});
}
