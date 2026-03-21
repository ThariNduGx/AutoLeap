import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { verifyWebhookSignature } from '@/lib/infrastructure/messenger';

// Force edge runtime for instant startup and low cost
export const runtime = 'edge';

// Messenger payloads are small (a few KB). Enforce a hard cap.
const MAX_BODY_BYTES = 16_384; // 16 KB

const GRAPH_API_BASE = 'https://graph.facebook.com/v24.0';

/**
 * GET /webhooks/messenger
 * Facebook Webhook Verification Endpoint
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        if (mode !== 'subscribe') {
            return new NextResponse('Invalid mode', { status: 403 });
        }

        const verifyToken = process.env.FB_VERIFY_TOKEN;
        if (!verifyToken) {
            return new NextResponse('Server configuration error', { status: 500 });
        }

        if (token !== verifyToken) {
            return new NextResponse('Invalid verify token', { status: 403 });
        }

        console.log('[MESSENGER WEBHOOK] ✅ Verification successful');
        return new NextResponse(challenge, { status: 200 });

    } catch (error) {
        console.error('[MESSENGER WEBHOOK] Verification error:', error);
        return new NextResponse('Internal error', { status: 500 });
    }
}

/**
 * POST /webhooks/messenger
 * Facebook Messenger Event Webhook
 */
export async function POST(req: Request) {
    try {
        // 1. SECURITY: verify HMAC signature before reading body
        const signature = req.headers.get('X-Hub-Signature-256');
        const appSecret = process.env.FB_APP_SECRET;

        if (!appSecret) {
            console.error('[MESSENGER WEBHOOK] FB_APP_SECRET not configured');
            return new NextResponse('Server configuration error', { status: 500 });
        }

        if (!signature) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 2. SIZE ENFORCEMENT — read as text so we control bytes in memory
        const rawBody = await req.text();
        if (rawBody.length > MAX_BODY_BYTES) {
            return new NextResponse('Payload Too Large', { status: 413 });
        }

        // 3. VERIFY SIGNATURE
        const isValid = await verifyWebhookSignature(signature, rawBody, appSecret);
        if (!isValid) {
            return new NextResponse('Invalid signature', { status: 401 });
        }

        // 4. PARSE
        let body: any;
        try {
            body = JSON.parse(rawBody);
        } catch {
            return new NextResponse('Bad Request', { status: 400 });
        }

        if (body.object !== 'page') {
            return new NextResponse('OK', { status: 200 });
        }

        // 5. PROCESS ENTRIES — collect all tasks first, then run in parallel
        const tasks: Promise<void>[] = [];

        for (const entry of (body.entry || [])) {
            for (const event of (entry.messaging || [])) {
                const senderId: string = event.sender?.id;
                const recipientId: string = event.recipient?.id; // Page ID

                // Ignore echo messages
                if (event.message?.is_echo) continue;

                const quickReplyPayload: string | undefined = event.message?.quick_reply?.payload;

                // ── Appointment confirm / cancel quick reply ───────────────────────
                if (quickReplyPayload?.startsWith('confirm_appt:') || quickReplyPayload?.startsWith('cancel_appt:')) {
                    tasks.push(handleApptAction(senderId, recipientId, quickReplyPayload));
                    continue;
                }

                // ── Review rating quick reply ──────────────────────────────────────
                if (quickReplyPayload?.startsWith('review:')) {
                    tasks.push(handleReviewAction(senderId, recipientId, quickReplyPayload, event.message?.mid));
                    continue;
                }

                // ── Slot selection quick reply ─────────────────────────────────────
                if (quickReplyPayload?.startsWith('SLOT_')) {
                    const parts = quickReplyPayload.split('_'); // ['SLOT', 'YYYY-MM-DD', 'HH:MM']
                    const date = parts[1];
                    const time = parts[2];
                    if (date && time) {
                        tasks.push(processIncomingMessage({
                            senderId, recipientId,
                            text: `slot:${date}:${time}`,
                            messageId: event.message?.mid,
                            timestamp: event.timestamp,
                            rawPayload: event,
                        }));
                    }
                    continue;
                }

                // ── Postback slot selection ────────────────────────────────────────
                if (event.postback?.payload?.startsWith('SLOT_')) {
                    const parts = event.postback.payload.split('_');
                    const date = parts[1];
                    const time = parts[2];
                    if (date && time) {
                        tasks.push(processIncomingMessage({
                            senderId, recipientId,
                            text: `slot:${date}:${time}`,
                            messageId: `postback_${event.timestamp}`,
                            timestamp: event.timestamp,
                            rawPayload: event,
                        }));
                    }
                    continue;
                }

                // ── Regular text message ───────────────────────────────────────────
                if (event.message?.text) {
                    tasks.push(processIncomingMessage({
                        senderId, recipientId,
                        text: event.message.text,
                        messageId: event.message.mid,
                        timestamp: event.timestamp,
                        rawPayload: event,
                    }));
                }
            }
        }

        // Run all event tasks in parallel
        await Promise.all(tasks);

        return new NextResponse('OK', { status: 200 });

    } catch (error) {
        console.error('[MESSENGER WEBHOOK] Processing error:', error);
        return new NextResponse('OK', { status: 200 });
    }
}

// ── Appointment confirm / cancel ────────────────────────────────────────────

async function handleApptAction(senderId: string, recipientId: string, payload: string) {
    const isConfirm = payload.startsWith('confirm_appt:');
    const apptId = payload.split(':')[1];
    if (!apptId) return;

    const supabase = getSupabaseClient();

    // Look up business + fb_page_access_token
    const { data: business } = await (supabase.from('businesses') as any)
        .select('id, fb_page_access_token')
        .eq('fb_page_id', recipientId)
        .single();
    if (!business?.fb_page_access_token) return;

    if (!isConfirm) {
        await (supabase.from('appointments') as any)
            .update({ status: 'cancelled' })
            .eq('id', apptId)
            .eq('business_id', business.id);

        // Notify waitlist — fire and forget
        notifyWaitlistAfterCancelMessenger(supabase, business.id, apptId, business.fb_page_access_token).catch(() => {});
    }

    const ackText = isConfirm
        ? '✅ Your appointment is confirmed! See you then.'
        : '❌ Your appointment has been cancelled. Feel free to rebook anytime.';

    fetch(`${GRAPH_API_BASE}/me/messages?access_token=${business.fb_page_access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: ackText },
            messaging_type: 'RESPONSE',
        }),
    }).catch(() => {});
}

// ── Review rating ───────────────────────────────────────────────────────────

async function handleReviewAction(
    senderId: string,
    recipientId: string,
    payload: string,
    messageId: string | undefined,
) {
    // payload format: "review:<apptId>:<rating>"
    const [, apptId, ratingStr] = payload.split(':');
    const rating = parseInt(ratingStr);
    if (!apptId || rating < 1 || rating > 5) return;

    const supabase = getSupabaseClient();

    const { data: business } = await (supabase.from('businesses') as any)
        .select('id, fb_page_access_token, telegram_bot_token, owner_telegram_chat_id, name')
        .eq('fb_page_id', recipientId)
        .single();
    if (!business?.fb_page_access_token) return;

    // Guard against duplicate taps
    const { data: existing } = await (supabase.from('reviews') as any)
        .select('id')
        .eq('appointment_id', apptId)
        .eq('customer_chat_id', String(senderId))
        .maybeSingle();

    if (!existing) {
        const { error: reviewErr } = await (supabase.from('reviews') as any).insert({
            business_id:      business.id,
            appointment_id:   apptId,
            customer_chat_id: String(senderId),
            platform:         'messenger',
            rating,
        });

        // Low-rating alert to owner
        if (!reviewErr && rating <= 2) {
            try {
                const { data: apptInfo } = await (supabase.from('appointments') as any)
                    .select('customer_name, service_type, appointment_date')
                    .eq('id', apptId)
                    .single();
                if (business.owner_telegram_chat_id && apptInfo && business.telegram_bot_token) {
                    const stars = '⭐'.repeat(rating);
                    const alertMsg = `⚠️ *Low Rating Alert*\n\n${stars} (${rating}/5) received from *${apptInfo.customer_name || 'a customer'}*\nService: ${apptInfo.service_type || 'Unknown'}\nDate: ${apptInfo.appointment_date || 'Unknown'}\n\nConsider following up with this customer directly.`;
                    fetch(`https://api.telegram.org/bot${business.telegram_bot_token}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: business.owner_telegram_chat_id, text: alertMsg, parse_mode: 'Markdown' }),
                    }).catch(() => {});
                }
            } catch { /* non-fatal */ }
        }
    }

    // Ack regardless (handles duplicate tap gracefully)
    const stars = '⭐'.repeat(rating);
    fetch(`${GRAPH_API_BASE}/me/messages?access_token=${business.fb_page_access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: `Thank you for your feedback! You rated us ${stars} (${rating}/5). We appreciate it!` },
            messaging_type: 'RESPONSE',
        }),
    }).catch(() => {});
}

// ── Incoming message → queue ────────────────────────────────────────────────

async function processIncomingMessage(message: {
    senderId: string;
    recipientId: string;
    text: string;
    messageId: string;
    timestamp: number;
    rawPayload: any;
}) {
    try {
        const supabase = getSupabaseClient();

        const { data: business, error: businessError } = await (supabase
            .from('businesses') as any)
            .select('id, fb_page_access_token')
            .eq('fb_page_id', message.recipientId)
            .single();

        if (businessError || !business) {
            console.error('[MESSENGER WEBHOOK] Business not found for page:', message.recipientId);
            return;
        }

        const idempotencyKey = message.messageId
            ? `fb:${business.id}:${message.messageId}`
            : undefined;

        const { error: queueError } = await (supabase
            .from('request_queue') as any)
            .insert({
                business_id: business.id,
                raw_payload: {
                    platform: 'messenger',
                    sender: { id: message.senderId },
                    recipient: { id: message.recipientId },
                    message: {
                        mid: message.messageId,
                        text: message.text,
                    },
                    timestamp: message.timestamp,
                    original: message.rawPayload,
                },
                status: 'pending',
                ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
            });

        if (queueError) {
            if ((queueError as any).code === '23505') {
                console.log('[MESSENGER WEBHOOK] Duplicate message ignored:', message.messageId);
                triggerQueue();
                return;
            }
            console.error('[MESSENGER WEBHOOK] Queue insert error:', queueError);
            return;
        }

        triggerQueue();
    } catch (error) {
        console.error('[MESSENGER WEBHOOK] Message processing error:', error);
    }
}

// Trigger the queue processor via Authorization header — NOT a query param —
// so the CRON_SECRET never appears in server logs or CDN access logs.
function triggerQueue() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const cronSecret = process.env.CRON_SECRET;
    if (!baseUrl || !cronSecret) return;
    fetch(`${baseUrl}/api/cron/process-queue`, {
        headers: { 'Authorization': `Bearer ${cronSecret}` },
    }).catch(() => {});
}

/** Notify first un-notified waitlist entry for the same service after a cancellation (Messenger). */
async function notifyWaitlistAfterCancelMessenger(
    supabase: ReturnType<typeof getSupabaseClient>,
    businessId: string,
    apptId: string,
    fbPageToken: string,
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

    if (!entry?.customer_chat_id || entry.platform !== 'messenger') return;

    const { data: biz } = await (supabase.from('businesses') as any)
        .select('name')
        .eq('id', businessId)
        .single();

    const firstName = entry.customer_name ? entry.customer_name.split(' ')[0] : 'there';
    const msg = `🎉 Spot Available!\n\nGood news, ${firstName}! A spot just opened up for ${entry.service_type} on ${appt.appointment_date} at ${biz?.name || 'us'}.\n\nReply "book" to secure your appointment now — slots go fast!`;

    const res = await fetch(`${GRAPH_API_BASE}/me/messages?access_token=${fbPageToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: entry.customer_chat_id },
            message: { text: msg },
            messaging_type: 'UPDATE',
        }),
    });

    if (res.ok) {
        await (supabase.from('waitlist') as any)
            .update({ notified_at: new Date().toISOString() })
            .eq('id', entry.id);
    }
}
