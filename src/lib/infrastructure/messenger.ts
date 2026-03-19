/**
 * Facebook Messenger API Client (Graph API v19.0+)
 * Handles sending messages and managing page interactions
 */

const GRAPH_API_VERSION = 'v24.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface MessengerMessage {
    recipientId: string;
    text: string;
    messagingType?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
}

interface MessengerResponse {
    recipient_id: string;
    message_id: string;
}

interface MessengerError {
    error: {
        message: string;
        type: string;
        code: number;
        fbtrace_id: string;
    };
}

/**
 * Send a message to a Messenger user
 * @param pageAccessToken - The Page Access Token for the business
 * @param message - Message configuration
 */
export async function sendMessengerMessage(
    pageAccessToken: string,
    message: MessengerMessage
): Promise<boolean> {
    const url = `${GRAPH_API_BASE}/me/messages?access_token=${pageAccessToken}`;

    try {
        console.log('[MESSENGER] Sending message to recipient:', message.recipientId);

        const payload = {
            recipient: {
                id: message.recipientId,
            },
            message: {
                text: message.text,
            },
            messaging_type: message.messagingType || 'RESPONSE',
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data: MessengerResponse | MessengerError = await response.json();

        if (!response.ok || 'error' in data) {
            const error = (data as MessengerError).error;
            console.error('[MESSENGER] Failed to send:', error.message);
            return false;
        }

        console.log('[MESSENGER] ✅ Message sent successfully:', (data as MessengerResponse).message_id);
        return true;
    } catch (error) {
        console.error('[MESSENGER] Exception during send:', error);
        return false;
    }
}

/**
 * Send typing indicator to show bot is processing
 * @param pageAccessToken - The Page Access Token
 * @param recipientId - The user to send typing indicator to
 */
export async function sendTypingIndicator(
    pageAccessToken: string,
    recipientId: string,
    action: 'typing_on' | 'typing_off' = 'typing_on'
): Promise<void> {
    const url = `${GRAPH_API_BASE}/me/messages?access_token=${pageAccessToken}`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient: {
                    id: recipientId,
                },
                sender_action: action,
            }),
        });
    } catch (error) {
        // Don't fail if typing indicator fails - it's just UX enhancement
        console.warn('[MESSENGER] Typing indicator failed:', error);
    }
}

/**
 * Verify webhook signature using HMAC SHA256
 * @param signature - X-Hub-Signature-256 header value
 * @param body - Raw request body
 * @param appSecret - Facebook App Secret
 */
export async function verifyWebhookSignature(
    signature: string,
    body: string,
    appSecret: string
): Promise<boolean> {
    try {
        // Extract the signature (format: "sha256=<hex>")
        const signatureParts = signature.split('=');
        if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
            console.error('[MESSENGER] Invalid signature format');
            return false;
        }

        const expectedHex = signatureParts[1];

        const encoder = new TextEncoder();

        // Import key for verification (constant-time via crypto.subtle.verify)
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(appSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        // Decode expected hex signature to bytes
        if (expectedHex.length % 2 !== 0) return false;
        const expectedBytes = new Uint8Array(expectedHex.length / 2);
        for (let i = 0; i < expectedHex.length; i += 2) {
            expectedBytes[i / 2] = parseInt(expectedHex.slice(i, i + 2), 16);
        }

        // crypto.subtle.verify performs constant-time HMAC comparison internally
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            expectedBytes,
            encoder.encode(body)
        );

        if (!isValid) {
            console.error('[MESSENGER] Signature verification failed');
        }

        return isValid;
    } catch (error) {
        console.error('[MESSENGER] Signature verification error:', error);
        return false;
    }
}

/**
 * Subscribe a page to webhook events
 * @param pageId - The Facebook Page ID
 * @param pageAccessToken - The Page Access Token
 * @param fields - Array of fields to subscribe to
 */
export async function subscribePageToWebhook(
    pageId: string,
    pageAccessToken: string,
    fields: string[] = ['messages', 'messaging_postbacks']
): Promise<boolean> {
    const url = `${GRAPH_API_BASE}/${pageId}/subscribed_apps`;

    try {
        console.log('[MESSENGER] Subscribing page to webhook:', pageId);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                access_token: pageAccessToken,
                subscribed_fields: fields,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error('[MESSENGER] Failed to subscribe page:', data);
            return false;
        }

        console.log('[MESSENGER] ✅ Page subscribed successfully');
        return true;
    } catch (error) {
        console.error('[MESSENGER] Exception during subscription:', error);
        return false;
    }
}

/**
 * Get user's managed pages
 * @param userAccessToken - User Access Token from Facebook Login
 */
export async function getUserPages(userAccessToken: string): Promise<any[]> {
    // Request pages with the Page Access Token included
    const url = `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,category&access_token=${userAccessToken}`;

    try {
        console.log('[MESSENGER] Fetching user pages from Facebook...');
        console.log('[MESSENGER] Token preview:', userAccessToken.substring(0, 20) + '...');

        const response = await fetch(url);
        const data = await response.json();

        console.log('[MESSENGER] Facebook API Response status:', response.status);
        console.log('[MESSENGER] Facebook API Response:', JSON.stringify(data, null, 2));

        if (!response.ok || 'error' in data) {
            const errorMsg = data.error?.message || 'Unknown Facebook API error';
            console.error('[MESSENGER] Failed to fetch pages:', errorMsg);
            console.error('[MESSENGER] Error details:', JSON.stringify(data.error, null, 2));
            throw new Error(`Facebook API error: ${errorMsg}`);
        }

        const pages = data.data || [];
        console.log(`[MESSENGER] Found ${pages.length} page(s)`);

        if (pages.length > 0) {
            console.log('[MESSENGER] Pages found:', pages.map((p: any) => ({ id: p.id, name: p.name })));
        } else {
            console.log('[MESSENGER] No pages found. This could mean:');
            console.log('  1. User is not an admin of any Facebook Pages');
            console.log('  2. User did not grant page permissions during Facebook login');
            console.log('  3. The Facebook App does not have pages_show_list permission');
        }

        return pages;
    } catch (error: any) {
        console.error('[MESSENGER] Exception fetching pages:', error.message);
        throw error; // Re-throw so the API route can handle it
    }
}

/**
 * Format message text (handle long messages)
 * Messenger has a 2000 character limit per message
 */
export function formatMessengerText(text: string, maxLength: number = 1900): string[] {
    if (text.length <= maxLength) {
        return [text];
    }

    const chunks: string[] = [];
    let currentChunk = '';

    // Split by sentences or newlines
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length + 1 <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            currentChunk = sentence;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

/**
 * Send a message with Messenger quick-reply buttons (for slot selection).
 * Quick replies appear as tappable chips below the message text.
 * Facebook limits: max 13 quick replies, title max 20 chars.
 *
 * @param pageAccessToken - Page Access Token
 * @param recipientId - Sender PSID
 * @param text - Prompt text shown above the buttons
 * @param slots - Array of time strings in HH:MM format
 * @param date - YYYY-MM-DD date for the slots (embedded in payload)
 */
export async function sendMessengerMessageWithQuickReplies(
    pageAccessToken: string,
    recipientId: string,
    text: string,
    slots: string[],
    date: string
): Promise<boolean> {
    const url = `${GRAPH_API_BASE}/me/messages?access_token=${pageAccessToken}`;

    // Facebook limit: max 13 quick replies per message
    const limitedSlots = slots.slice(0, 13);

    const quickReplies = limitedSlots.map(slot => ({
        content_type: 'text',
        title: slot,                        // e.g. "09:00"
        payload: `SLOT_${date}_${slot}`,    // e.g. "SLOT_2026-03-20_09:00"
    }));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text, quick_replies: quickReplies },
                messaging_type: 'RESPONSE',
            }),
        });

        const data = await response.json();
        if (!response.ok || 'error' in data) {
            console.error('[MESSENGER] Quick replies failed:', (data as any).error?.message);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[MESSENGER] Quick replies exception:', error);
        return false;
    }
}

/**
 * Build a slot-selection text prompt for Messenger quick replies.
 */
export function buildMessengerSlotPrompt(date: string): string {
    const d = new Date(`${date}T00:00:00`);
    const label = d.toLocaleDateString('en-LK', { weekday: 'long', month: 'long', day: 'numeric' });
    return `Available slots for ${label}. Tap a time to book:`;
}
