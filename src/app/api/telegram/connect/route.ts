import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * POST /api/telegram/connect
 * 
 * Connect Telegram bot to business account
 * Validates bot token and registers webhook
 */
export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getSession(request);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json(
                { error: 'Unauthorized - Business user access required' },
                { status: 403 }
            );
        }

        const businessId = session.businessId;

        if (!businessId) {
            return NextResponse.json(
                { error: 'No business associated with this account' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { bot_token } = body;

        if (!bot_token || typeof bot_token !== 'string') {
            return NextResponse.json(
                { error: 'Bot token is required' },
                { status: 400 }
            );
        }

        // Validate bot token format (should be like: 123456:ABC-DEF...)
        const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
        if (!tokenPattern.test(bot_token)) {
            return NextResponse.json(
                { error: 'Invalid bot token format. Please check your token from @BotFather' },
                { status: 400 }
            );
        }

        console.log('[TELEGRAM] Validating bot token for business:', businessId);

        // Step 1: Validate the bot token by calling getMe
        const validateRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
        const validateData = await validateRes.json();

        if (!validateData.ok) {
            return NextResponse.json(
                { error: 'Invalid bot token. Please check and try again.' },
                { status: 400 }
            );
        }

        const botInfo = validateData.result;
        console.log('[TELEGRAM] Bot validated:', botInfo.username);

        // Step 2: Register webhook
        const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com'}/api/webhooks/telegram`;

        const webhookRes = await fetch(
            `https://api.telegram.org/bot${bot_token}/setWebhook`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: webhookUrl,
                    secret_token: process.env.TELEGRAM_BOT_TOKEN || 'your-secret-token',
                }),
            }
        );

        const webhookData = await webhookRes.json();

        if (!webhookData.ok) {
            console.error('[TELEGRAM] Webhook registration failed:', webhookData);
            return NextResponse.json(
                { error: 'Failed to register webhook. Please try again.' },
                { status: 500 }
            );
        }

        console.log('[TELEGRAM] Webhook registered:', webhookUrl);

        // Step 3: Save to database
        const supabase = getSupabaseClient();

        const { error: updateError } = await (supabase
            .from('businesses') as any)
            .update({
                telegram_bot_token: bot_token,
                updated_at: new Date().toISOString(),
            })
            .eq('id', businessId);

        if (updateError) {
            console.error('[TELEGRAM] Database update error:', updateError);
            return NextResponse.json(
                { error: 'Failed to save bot configuration' },
                { status: 500 }
            );
        }

        console.log('[TELEGRAM] ✅ Bot connected successfully');

        return NextResponse.json({
            success: true,
            bot: {
                username: botInfo.username,
                name: botInfo.first_name,
            },
            webhookUrl,
            message: 'Telegram bot connected successfully!',
        });

    } catch (error: any) {
        console.error('[TELEGRAM] Connection error:', error);
        return NextResponse.json(
            { error: 'Failed to connect Telegram bot', details: error.message },
            { status: 500 }
        );
    }
}
