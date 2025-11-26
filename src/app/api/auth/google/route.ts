import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

export const dynamic = 'force-dynamic';

/**
 * Initiate Google OAuth flow
 * Navigate to: http://localhost:3000/api/auth/google?business_id=YOUR_ID
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get('business_id');

  if (!businessId) {
    return new NextResponse('Missing business_id parameter', { status: 400 });
  }

  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: businessId, // Pass business ID through OAuth flow
  });

  return NextResponse.redirect(authUrl);
}

