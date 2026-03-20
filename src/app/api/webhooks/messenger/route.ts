import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { verifyWebhookSignature } from '@/lib/infrastructure/messenger';

// Force edge runtime for instant startup and low cost
export const runtime = 'edge';

/**
 * GET /webhooks/messenger
 * 
 * Facebook Webhook Verification Endpoint
 * 
 * Facebook will send a GET request with the following query parameters:
 * - hub.mode: 'subscribe'
 * - hub.verify_token: The token you configured in Facebook App settings
 * - hub.challenge: A random string to echo back
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        console.log('[MESSENGER WEBHOOK] Verification request received');

        // Verify mode
        if (mode !== 'subscribe') {
            console.error('[MESSENGER WEBHOOK] Invalid mode:', mode);
            return new NextResponse('Invalid mode', { status: 403 });
        }

        // Verify token matches the one we configured
        const verifyToken = process.env.FB_VERIFY_TOKEN;

        if (!verifyToken) {
            console.error('[MESSENGER WEBHOOK] FB_VERIFY_TOKEN not configured');
            return new NextResponse('Server configuration error', { status: 500 });
        }

        if (token !== verifyToken) {
            console.error('[MESSENGER WEBHOOK] Token mismatch');
            return new NextResponse('Invalid verify token', { status: 403 });
        }

        // Return the challenge to complete verification
        console.log('[MESSENGER WEBHOOK] ✅ Verification successful');
        return new NextResponse(challenge, { status: 200 });

    } catch (error) {
        console.error('[MESSENGER WEBHOOK] Verification error:', error);
        return new NextResponse('Internal error', { status: 500 });
    }
}

/**
 * POST /webhooks/messenger
 * 
 * Facebook Messenger Event Webhook
 * 
 * Receives incoming messages and events from Messenger
 */
export async function POST(req: Request) {
    try {
        // Step 1: Verify webhook signature (CRITICAL for security)
        const signature = req.headers.get('X-Hub-Signature-256');
        const appSecret = process.env.FB_APP_SECRET;

        if (!appSecret) {
            console.error('[MESSENGER WEBHOOK] FB_APP_SECRET not configured');
            return new NextResponse('Server configuration error', { status: 500 });
        }

        if (!signature) {
            console.error('[MESSENGER WEBHOOK] No signature provided');
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Read the raw body for signature verification
        const rawBody = await req.text();

        // Verify the signature
        const isValid = await verifyWebhookSignature(signature, rawBody, appSecret);

        if (!isValid) {
            console.error('[MESSENGER WEBHOOK] Invalid signature');
            return new NextResponse('Invalid signature', { status: 401 });
        }

        // Parse the body
        const body = JSON.parse(rawBody);

        console.log('[MESSENGER WEBHOOK] Received event:', body.object);

        // Ensure this is a page event
        if (body.object !== 'page') {
            return new NextResponse('OK', { status: 200 });
        }

        // Step 2: Process entries
        const entries = body.entry || [];

        for (const entry of entries) {
            const messagingEvents = entry.messaging || [];

            for (const event of messagingEvents) {
                // Extract sender and recipient
                const senderId = event.sender?.id;
                const recipientId = event.recipient?.id; // This is the Page ID

                // Step 3: Ignore echo messages (messages sent by the page itself)
                if (event.message && event.message.is_echo) {
                    console.log('[MESSENGER WEBHOOK] Ignoring echo message');
                    continue;
                }

                // Process regular messages
                if (event.message && event.message.text) {
                    console.log('[MESSENGER WEBHOOK] Processing message from:', senderId);

                    await processIncomingMessage({
                        senderId,
                        recipientId,
                        text: event.message.text,
                        messageId: event.message.mid,
                        timestamp: event.timestamp,
                        rawPayload: event,
                    });
                }

                // Handle quick reply slot selection (payload: "SLOT_YYYY-MM-DD_HH:MM")
                if (event.message?.quick_reply?.payload?.startsWith('SLOT_')) {
                    const parts = event.message.quick_reply.payload.split('_'); // ['SLOT', 'YYYY-MM-DD', 'HH:MM']
                    const date = parts[1];
                    const time = parts[2];
                    if (date && time) {
                        console.log('[MESSENGER WEBHOOK] Slot selected:', date, time);
                        await processIncomingMessage({
                            senderId,
                            recipientId,
                            text: `slot:${date}:${time}`,  // matches Telegram slot: format
                            messageId: event.message.mid,
                            timestamp: event.timestamp,
                            rawPayload: event,
                        });
                    }
                    continue;
                }

                // Handle postbacks (button clicks from templates)
                if (event.postback?.payload?.startsWith('SLOT_')) {
                    const parts = event.postback.payload.split('_');
                    const date = parts[1];
                    const time = parts[2];
                    if (date && time) {
                        await processIncomingMessage({
                            senderId,
                            recipientId,
                            text: `slot:${date}:${time}`,
                            messageId: `postback_${event.timestamp}`,
                            timestamp: event.timestamp,
                            rawPayload: event,
                        });
                    }
                    continue;
                }

                // Handle message reads, deliveries, etc.
                // We can ignore these for now
            }
        }

        // Always return 200 OK to Facebook within 20 seconds
        return new NextResponse('OK', { status: 200 });

    } catch (error) {
        console.error('[MESSENGER WEBHOOK] Processing error:', error);

        // Still return 200 to prevent Facebook from retrying
        // Log the error for debugging
        return new NextResponse('OK', { status: 200 });
    }
}

/**
 * Process an incoming message by adding it to the queue
 */
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

        // Lookup the business by fb_page_id (recipientId is the Page ID)
        const { data: business, error: businessError } = await (supabase
            .from('businesses') as any)
            .select('id')
            .eq('fb_page_id', message.recipientId)
            .single();

        if (businessError || !business) {
            console.error('[MESSENGER WEBHOOK] Business not found for page:', message.recipientId);
            return;
        }

        console.log('[MESSENGER WEBHOOK] Matched to business:', business.id);

        // Add to request queue for async processing.
        // Use messageId as idempotency key — Facebook may deliver the same event twice.
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
            // 23505 = unique_violation → duplicate delivery, silently ignore
            if ((queueError as any).code === '23505') {
                console.log('[MESSENGER WEBHOOK] Duplicate message ignored:', message.messageId);
                return;
            }
            console.error('[MESSENGER WEBHOOK] Queue insert error:', queueError);
            return;
        }

        console.log('[MESSENGER WEBHOOK] ✅ Message queued for processing');

        // Trigger queue processor immediately (fire-and-forget — don't await)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        const cronSecret = process.env.CRON_SECRET;
        if (baseUrl && cronSecret) {
            fetch(`${baseUrl}/api/cron/process-queue?key=${cronSecret}`)
                .catch(err => console.warn('[MESSENGER WEBHOOK] Failed to trigger queue processor:', err));
        } else {
            console.warn('[MESSENGER WEBHOOK] NEXT_PUBLIC_BASE_URL or CRON_SECRET not set — skipping queue trigger');
        }

    } catch (error) {
        console.error('[MESSENGER WEBHOOK] Message processing error:', error);
    }
}
