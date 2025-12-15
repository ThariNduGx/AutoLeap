import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Extract business_id from state
    const businessId = state || process.env.DEFAULT_BUSINESS_ID;

    if (!businessId) {
      return NextResponse.json({ error: 'No business ID provided' }, { status: 400 });
    }

    // Store tokens in database - BYPASS TypeScript checking completely
    const supabase = getSupabaseClient();

    // Cast to any to bypass strict type checking for update
    const updateQuery = (supabase.from('businesses') as any)
      .update({ google_calendar_token: JSON.stringify(tokens) })
      .eq('id', businessId);

    const { error } = await updateQuery;

    if (error) {
      console.error('[OAUTH] Failed to store tokens:', error);
      return NextResponse.json({ error: 'Failed to store tokens' }, { status: 500 });
    }

    console.log('[OAUTH] ✅ Calendar connected for business:', businessId);

    // Return success page
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendar Connected</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
              max-width: 400px;
            }
            h1 {
              color: #667eea;
              margin-bottom: 1rem;
            }
            p {
              color: #666;
              line-height: 1.6;
            }
            .checkmark {
              font-size: 4rem;
              color: #10b981;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✓</div>
            <h1>Calendar Connected!</h1>
            <p>Your Google Calendar has been successfully connected to AutoLeap.</p>
            <p>You can now close this window and start accepting bookings.</p>
          </div>
        </body>
      </html>
    `, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('[OAUTH] Error:', error);
    return NextResponse.json({ error: 'OAuth flow failed' }, { status: 500 });
  }
}