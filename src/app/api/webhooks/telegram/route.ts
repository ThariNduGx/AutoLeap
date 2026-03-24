import { NextResponse, after } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { answerCallbackQuery, getWebhookSecret } from '@/lib/infrastructure/telegram';
import { processQueue } from '@/lib/core/queue-processor';

// Node.js runtime required — processQueue uses setInterval and dynamic imports
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // ── SECURITY: shared platform webhook secret ──────────────────────────────
    // Single secret avoids the fragile per-business DB lookup on every hit.
    const webhookSecret = getWebhookSecret();
    const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');

    if (!webhookSecret || secretToken !== webhookSecret) {
      console.error('[TELEGRAM WEBHOOK] Secret mismatch');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // ── SIZE CHECK ────────────────────────────────────────────────────────────
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 16_384) {
      return new NextResponse('Payload Too Large', { status: 413 });
    }

    const body = await req.json();
    const supabase = getSupabaseClient();

    // ── BUSINESS ID from URL param (set at webhook registration time) ─────────
    const reqUrl = new URL(req.url);
    const businessId = reqUrl.searchParams.get('businessId') || process.env.DEFAULT_BUSINESS_ID;

    if (!businessId) {
      console.error('[TELEGRAM WEBHOOK] No businessId in URL and DEFAULT_BUSINESS_ID not set');
      return new NextResponse('Bad Request', { status: 400 });
    }

    // ── CALLBACK QUERY (inline keyboard button tap) ───────────────────────────
    if (body.callback_query) {
      const cq = body.callback_query;
      const callbackData: string = cq.data || '';

      // Dismiss Telegram's loading spinner immediately
      const { data: biz } = await (supabase
        .from('businesses') as any)
        .select('telegram_bot_token')
        .eq('id', businessId)
        .single();

      if (biz?.telegram_bot_token) {
        await answerCallbackQuery(biz.telegram_bot_token, cq.id);
      }

      // Deduplication check
      const updateId = body.update_id;
      if (updateId) {
        const { data: existing } = await (supabase
          .from('request_queue') as any)
          .select('id')
          .filter('raw_payload->>update_id', 'eq', String(updateId))
          .limit(1);
        if (existing && existing.length > 0) {
          console.log('[TELEGRAM WEBHOOK] Duplicate callback ignored:', updateId);
          return new NextResponse('OK', { status: 200 });
        }
      }

      const { error } = await (supabase.from('request_queue') as any).insert({
        business_id: businessId,
        raw_payload: {
          ...body,
          platform: 'telegram',
          type: 'callback',
          callback_data: callbackData,
          sender_id: String(cq.from?.id || ''),
          chat_id: String(cq.message?.chat?.id || cq.from?.id || ''),
        },
        status: 'pending',
      });

      if (error) {
        console.error('[TELEGRAM WEBHOOK] Callback queue error:', error);
        return new NextResponse('Database Error', { status: 500 });
      }

      after(processQueue(1).catch(err =>
        console.error('[TELEGRAM WEBHOOK] Queue processor error:', err)
      ));
      return new NextResponse('OK', { status: 200 });
    }

    // ── IGNORE non-message updates ────────────────────────────────────────────
    if (!body.message && !body.edited_message) {
      return new NextResponse('OK', { status: 200 });
    }

    // ── DEDUPLICATION for regular messages ───────────────────────────────────
    const updateId = body.update_id;
    if (updateId) {
      const { data: existing } = await (supabase
        .from('request_queue') as any)
        .select('id')
        .filter('raw_payload->>update_id', 'eq', String(updateId))
        .limit(1);
      if (existing && existing.length > 0) {
        console.log('[TELEGRAM WEBHOOK] Duplicate update skipped:', updateId);
        return new NextResponse('OK', { status: 200 });
      }
    }

    // ── ENQUEUE ───────────────────────────────────────────────────────────────
    const { error } = await (supabase.from('request_queue') as any).insert({
      business_id: businessId,
      raw_payload: { ...body, platform: 'telegram' },
      status: 'pending',
    });

    if (error) {
      console.error('[TELEGRAM WEBHOOK] Queue insert error:', error);
      // Return 500 so Telegram retries delivery
      return new NextResponse('Database Error', { status: 500 });
    }

    console.log('[TELEGRAM WEBHOOK] ✅ Message queued for business:', businessId);

    // Process inline — no HTTP self-call needed
    after(processQueue(1).catch(err =>
      console.error('[TELEGRAM WEBHOOK] Queue processor error:', err)
    ));

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('[TELEGRAM WEBHOOK] Fatal error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
