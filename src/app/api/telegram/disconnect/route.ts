import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

/**
 * POST /api/telegram/disconnect
 * 
 * Disconnect Telegram bot from business account
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const supabase = getSupabaseClient();

        // Get current bot token to remove webhook
        const { data: business } = await (supabase
            .from('businesses') as any)
            .select('telegram_bot_token')
            .eq('id', session.businessId)
            .single();

        // Remove webhook from Telegram
        if (business?.telegram_bot_token) {
            await fetch(
                `https://api.telegram.org/bot${business.telegram_bot_token}/deleteWebhook`,
                { method: 'POST' }
            );
        }

        // Clear from database
        const { error } = await (supabase
            .from('businesses') as any)
            .update({
                telegram_bot_token: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', session.businessId);

        if (error) {
            return NextResponse.json(
                { error: 'Failed to disconnect' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[TELEGRAM DISCONNECT] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
