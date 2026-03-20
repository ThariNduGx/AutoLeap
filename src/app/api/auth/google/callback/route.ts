import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const calendarUrl = `${baseUrl}/dashboard/calendar`;

    if (error) {
        return NextResponse.redirect(`${calendarUrl}?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${calendarUrl}?error=missing_params`);
    }

    const businessId = state;

    try {
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch the user's email from Google
        let calendarEmail: string | null = null;
        try {
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();
            calendarEmail = userInfo.data.email || null;
        } catch {
            // Non-fatal — email display is optional
        }

        const supabase = getSupabaseClient();

        const { error: dbError } = await (supabase.from('businesses') as any)
            .update({
                google_calendar_token: JSON.stringify(tokens),
                google_calendar_email: calendarEmail,
            })
            .eq('id', businessId);

        if (dbError) {
            console.error('[OAUTH] Failed to store tokens:', dbError);
            return NextResponse.redirect(`${calendarUrl}?error=db_error`);
        }

        console.log('[OAUTH] ✅ Calendar connected for business:', businessId, 'email:', calendarEmail);
        return NextResponse.redirect(`${calendarUrl}?connected=true`);
    } catch (err) {
        console.error('[OAUTH] Error during token exchange:', err);
        return NextResponse.redirect(`${calendarUrl}?error=oauth_failed`);
    }
}
