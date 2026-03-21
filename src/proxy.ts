import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Get session
    const session = await getSession(request);

    // Public routes (no auth needed)
    const publicRoutes = ['/', '/auth/login', '/auth/signup'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // Admin routes
    const isAdminRoute = pathname.startsWith('/admin');

    // Business dashboard routes
    const isDashboardRoute = pathname.startsWith('/dashboard');

    // API routes protection
    const isAdminApiRoute = pathname.startsWith('/api/admin');
    const isBusinessApiRoute =
        pathname.startsWith('/api/business') ||
        pathname.startsWith('/api/conversations') ||
        pathname.startsWith('/api/bookings') ||
        pathname.startsWith('/api/costs') ||
        pathname.startsWith('/api/dashboard') ||
        pathname.startsWith('/api/analytics') ||
        pathname.startsWith('/api/settings');

    // Unauthenticated access to protected API routes → 401
    if (!session && (isAdminApiRoute || isBusinessApiRoute)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If no session and trying to access protected UI route
    if (!session && (isAdminRoute || isDashboardRoute)) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // If session exists
    if (session) {
        // Admin trying to access business dashboard
        if (session.role === 'admin' && isDashboardRoute) {
            return NextResponse.redirect(new URL('/admin', request.url));
        }

        // Business user trying to access admin area
        if (session.role === 'business' && isAdminRoute) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        // Business user trying to access admin API
        if (session.role === 'business' && isAdminApiRoute) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Admin trying to access business-only API routes
        if (session.role === 'admin' && isBusinessApiRoute) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // On login page with active session - redirect to appropriate dashboard
        if (pathname === '/auth/login') {
            const redirectUrl = session.role === 'admin' ? '/admin' : '/dashboard';
            return NextResponse.redirect(new URL(redirectUrl, request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/admin/:path*',
        '/api/admin/:path*',
        '/api/business/:path*',
        '/api/conversations/:path*',
        '/api/bookings/:path*',
        '/api/costs',
        '/api/costs/:path*',
        '/api/dashboard/:path*',
        '/api/analytics',
        '/api/analytics/:path*',
        '/api/settings/:path*',
        '/auth/login',
    ],
};
