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

      // ── Appointment confirmation from reminder ─────────────────────────
      if (data.startsWith('confirm_appt:') || data.startsWith('cancel_appt:')) {
        const isConfirm = data.startsWith('confirm_appt:');
        const apptId = data.split(':')[1];

        const supabaseAppt = getSupabaseClient();
        if (!isConfirm) {
          // Cancel: update status to cancelled
          await (supabaseAppt.from('appointments') as any)
            .update({ status: 'cancelled' })
            .eq('id', apptId)
            .eq('business_id', businessId);

          // Notify waitlist — fire and forget
          notifyWaitlistAfterCancel(supabaseAppt, businessId, apptId, botToken).catch(() => {});
        }
        // Confirmation: appointment stays 'scheduled' — just acknowledge the customer

        const ackText = isConfirm
          ? '✅ Your appointment is confirmed! See you then.'
          : '❌ Your appointment has been cancelled. Feel free to rebook anytime.';

        // Answer the callback to remove the spinner
        fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cq.id, text: isConfirm ? '✅ Confirmed!' : '❌ Cancelled' }),
        }).catch(() => {});

        // Edit the original message to remove the buttons and show the result
        if (cq.message?.message_id && cq.message?.chat?.id) {
          fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cq.message.chat.id,
              message_id: cq.message.message_id,
              reply_markup: { inline_keyboard: [] },
            }),
          }).catch(() => {});

          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: cq.message.chat.id, text: ackText }),
          }).catch(() => {});
        }

        return new NextResponse('OK', { status: 200 });
      }

      // ── Review rating from post-appointment request ───────────────────────
      if (data.startsWith('review:')) {
        const [, apptId, ratingStr] = data.split(':');
        const rating = parseInt(ratingStr);

        if (apptId && rating >= 1 && rating <= 5) {
          const chatId = cq.message?.chat?.id || cq.from?.id;

          // Save the review — check for duplicate first (customer tapping twice)
          const { error: reviewErr } = await (supabase.from('reviews') as any).insert({
            business_id:      businessId,
            appointment_id:   apptId,
            customer_chat_id: String(chatId),
            platform:         'telegram',
            rating,
          });

          // If review saved and rating is ≤ 2 stars, alert the owner immediately
          if (!reviewErr && rating <= 2) {
            try {
              const { data: biz } = await (supabase.from('businesses') as any)
                .select('telegram_bot_token, owner_telegram_chat_id, name')
                .eq('id', businessId)
                .single();
              const { data: apptInfo } = await (supabase.from('appointments') as any)
                .select('customer_name, service_type, appointment_date')
                .eq('id', apptId)
                .single();
              if (biz?.owner_telegram_chat_id && apptInfo) {
                const stars = '⭐'.repeat(rating);
                const alertMsg = `⚠️ *Low Rating Alert*\n\n${stars} (${rating}/5) received from *${apptInfo.customer_name || 'a customer'}*\nService: ${apptInfo.service_type || 'Unknown'}\nDate: ${apptInfo.appointment_date || 'Unknown'}\n\nConsider following up with this customer directly.`;
                fetch(`https://api.telegram.org/bot${biz.telegram_bot_token}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: biz.owner_telegram_chat_id,
                    text: alertMsg,
                    parse_mode: 'Markdown',
                  }),
                }).catch(() => {});
              }
            } catch { /* non-fatal */ }
          }

          // Ack + remove buttons
          fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id, text: 'Thank you for your feedback! ⭐' }),
          }).catch(() => {});

          if (cq.message?.message_id && chatId) {
            fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: cq.message.message_id,
                reply_markup: { inline_keyboard: [] },
              }),
            }).catch(() => {});

            const stars = '⭐'.repeat(rating);
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `Thank you, ${cq.from?.first_name || 'valued customer'}! You rated us ${stars} (${rating}/5). We appreciate your feedback!`,
              }),
            }).catch(() => {});
          }
        }

        return new NextResponse('OK', { status: 200 });
      }

      if (data.startsWith('slot:')) {
        // Format: "slot:YYYY-MM-DD:HH:MM" — time contains a colon, so extract carefully.
        const withoutPrefix = data.slice('slot:'.length); // "YYYY-MM-DD:HH:MM"
        const dateEnd = withoutPrefix.indexOf(':');
        const date = withoutPrefix.slice(0, dateEnd);     // "YYYY-MM-DD"
        const time = withoutPrefix.slice(dateEnd + 1);    // "HH:MM"

        // Enqueue as synthetic booking continuation (idempotent via callback update_id)
        const cbIdempotencyKey = body.update_id != null
          ? `tg:${businessId}:${body.update_id}`
          : undefined;

        const { error: cbError } = await (supabase.from('request_queue') as any).insert({
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
          ...(cbIdempotencyKey ? { idempotency_key: cbIdempotencyKey } : {}),
        });

        if (cbError && (cbError as any).code === '23505') {
          console.log('[TELEGRAM WEBHOOK] Duplicate callback ignored:', body.update_id);
          triggerQueue();
          return new NextResponse('OK', { status: 200 });
        }

        if (cbError) {
          console.error('[TELEGRAM WEBHOOK] Callback queue error:', cbError);
          return new NextResponse('Internal Server Error', { status: 500 });
        }

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

    // 7. ENQUEUE MESSAGE (idempotent — Telegram retries use the same update_id)
    const updateId: number | undefined = body.update_id;
    const idempotencyKey = updateId != null ? `tg:${businessId}:${updateId}` : undefined;

    const { error } = await (supabase
      .from('request_queue') as any)
      .insert({
        business_id: businessId,
        raw_payload: body,
        status: 'pending',
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      });

    if (error) {
      // 23505 = unique_violation → duplicate delivery, silently ignore
      if ((error as any).code === '23505') {
        console.log('[TELEGRAM WEBHOOK] Duplicate update_id ignored:', updateId);
        return new NextResponse('OK', { status: 200 });
      }
      console.error('[TELEGRAM WEBHOOK] Queue error:', error);
      // Return 500 so Telegram retries delivery (message won't be silently dropped)
      return new NextResponse('Internal Server Error', { status: 500 });
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

/** Notify first un-notified waitlist entry for the same service after a cancellation. */
async function notifyWaitlistAfterCancel(
  supabase: ReturnType<typeof getSupabaseClient>,
  businessId: string,
  apptId: string,
  botToken: string
) {
  const { data: appt } = await (supabase.from('appointments') as any)
    .select('service_type, appointment_date')
    .eq('id', apptId)
    .single();
  if (!appt?.service_type) return;

  const { data: entry } = await (supabase.from('waitlist') as any)
    .select('id, customer_chat_id, customer_name, service_type, platform')
    .eq('business_id', businessId)
    .eq('service_type', appt.service_type)
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!entry?.customer_chat_id || entry.platform !== 'telegram') return;

  const { data: biz } = await (supabase.from('businesses') as any)
    .select('name')
    .eq('id', businessId)
    .single();

  const firstName = entry.customer_name ? entry.customer_name.split(' ')[0] : 'there';
  const msg = `🎉 *Spot Available!*\n\nGood news, ${firstName}! A spot just opened up for *${entry.service_type}* on ${appt.appointment_date} at *${biz?.name || 'us'}*.\n\nReply "book" to secure your appointment now — slots go fast!`;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: entry.customer_chat_id, text: msg, parse_mode: 'Markdown' }),
  });

  if (res.ok) {
    await (supabase.from('waitlist') as any)
      .update({ notified_at: new Date().toISOString() })
      .eq('id', entry.id);
  }
}
