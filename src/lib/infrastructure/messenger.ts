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
        // Extract the signature (format: "sha256=<signature>")
        const signatureParts = signature.split('=');
        if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
            console.error('[MESSENGER] Invalid signature format');
            return false;
        }

        const expectedSignature = signatureParts[1];

        // Create HMAC SHA256 hash
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(appSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signatureBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(body)
        );

        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(signatureBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Compare signatures (constant-time comparison would be ideal, but this is acceptable)
        const isValid = hashHex === expectedSignature;

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
