import { NextResponse } from 'next/server';
import { createLogoutCookie } from '@/lib/auth/session';

/**
 * POST /api/auth/logout
 * Clears the session cookie
 */
export async function POST() {
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', createLogoutCookie());
    return response;
}
