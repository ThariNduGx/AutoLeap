import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getUserPages, subscribePageToWebhook } from '@/lib/infrastructure/messenger';

// Force edge runtime for instant startup
export const runtime = 'edge';

interface ConnectRequest {
    user_access_token: string;
    page_id?: string; // Optional: if multiple pages, specify which one
}

/**
 * POST /api/facebook/connect
 * 
 * Connect a Facebook Page to a business account
 * Requires business user authentication
 * 
 * Request Body:
 * {
 *   "user_access_token": "EAAxxxx...",
 *   "page_id": "123456789" // Optional
 * }
 */
export async function POST(req: NextRequest) {
    try {
        // Check authentication - business user only
        const session = await getSession(req);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json(
                { error: 'Unauthorized - Business user access required' },
                { status: 403 }
            );
        }

        // Get business ID from session (security: user can only connect their own business)
        const businessId = session.businessId;

        if (!businessId) {
            return NextResponse.json(
                { error: 'No business associated with this account' },
                { status: 400 }
            );
        }

        // Parse request body
        const body: ConnectRequest = await req.json();

        // Validate required fields
        if (!body.user_access_token) {
            return NextResponse.json(
                { error: 'Missing required field: user_access_token' },
                { status: 400 }
            );
        }

        console.log('[FACEBOOK] Connecting page for business:', businessId);

        // Step A: Fetch user's managed pages from Facebook
        let pages;
        try {
            pages = await getUserPages(body.user_access_token);
        } catch (err: any) {
            return NextResponse.json(
                {
                    error: 'Failed to fetch Facebook Pages',
                    details: err.message,
                    help: 'Make sure your Facebook App has the pages_show_list permission approved.'
                },
                { status: 500 }
            );
        }

        if (!pages || pages.length === 0) {
            return NextResponse.json(
                {
                    error: 'No Facebook Pages found for this user',
                    help: [
                        '1. Make sure you are an Admin or Editor of at least one Facebook Page',
                        '2. During Facebook login, you must select which Pages to grant access to',
                        '3. Click "Connect Facebook Page" again and select your page in the Facebook popup',
                        '4. If you deselected your pages, go to Facebook Settings > Business Integrations and remove this app, then try again'
                    ]
                },
                { status: 404 }
            );
        }

        console.log(`[FACEBOOK] Found ${pages.length} page(s)`);

        // Step B: Select the correct page
        let selectedPage;

        if (body.page_id) {
            // Filter by specified page_id
            selectedPage = pages.find((page: any) => page.id === body.page_id);

            if (!selectedPage) {
                return NextResponse.json(
                    { error: `Page with ID ${body.page_id} not found in user's managed pages` },
                    { status: 404 }
                );
            }
        } else {
            // Default to first page
            selectedPage = pages[0];
        }

        console.log('[FACEBOOK] Selected page:', selectedPage.name);

        // Step C: Extract the Page Access Token
        // The access_token in the page object is the Page Access Token, not the User Token
        const pageAccessToken = selectedPage.access_token;
        const pageId = selectedPage.id;
        const pageName = selectedPage.name;

        if (!pageAccessToken) {
            return NextResponse.json(
                { error: 'Failed to obtain Page Access Token' },
                { status: 500 }
            );
        }

        // Step D: Save to database
        const supabase = getSupabaseClient();

        // Check if page is already connected to another business
        const { data: existingConnection } = await (supabase
            .from('businesses') as any)
            .select('id, name')
            .eq('fb_page_id', pageId)
            .neq('id', businessId)
            .maybeSingle();

        if (existingConnection) {
            return NextResponse.json(
                {
                    error: 'This Facebook Page is already connected to another business',
                    connectedTo: existingConnection.name
                },
                { status: 409 }
            );
        }

        // Update business with Facebook credentials
        const { data: updatedBusiness, error: updateError } = await (supabase
            .from('businesses') as any)
            .update({
                fb_page_id: pageId,
                fb_page_access_token: pageAccessToken,
                fb_page_name: pageName,
            })
            .eq('id', businessId)
            .select()
            .single();

        if (updateError) {
            console.error('[FACEBOOK] Database update error:', updateError);
            return NextResponse.json(
                { error: 'Failed to save Facebook credentials', details: updateError.message },
                { status: 500 }
            );
        }

        console.log('[FACEBOOK] ✅ Saved to database');

        // Step E: Subscribe page to webhooks
        const subscribed = await subscribePageToWebhook(
            pageId,
            pageAccessToken,
            ['messages', 'messaging_postbacks']
        );

        if (!subscribed) {
            console.warn('[FACEBOOK] ⚠️ Failed to subscribe page to webhooks');
            // Note: We don't fail the entire request since the credentials are saved
            // The user can manually subscribe or retry
        }

        console.log('[FACEBOOK] ✅ Page connected successfully');

        return NextResponse.json({
            success: true,
            page: {
                id: pageId,
                name: pageName,
            },
            webhookSubscribed: subscribed,
            message: 'Facebook Page connected successfully',
        });

    } catch (error: any) {
        console.error('[FACEBOOK] Connection error:', error);

        return NextResponse.json(
            {
                error: 'Failed to connect Facebook Page',
                details: error.message
            },
            { status: 500 }
        );
    }
}
