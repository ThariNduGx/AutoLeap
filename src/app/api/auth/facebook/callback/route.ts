import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { subscribePageToWebhook } from '@/lib/infrastructure/messenger';

const GRAPH_API_BASE = 'https://graph.facebook.com/v24.0';

/** Returns a self-contained HTML page that navigates to /dashboard/settings via JS.
 *  Using JS navigation instead of a 302 redirect avoids the SameSite=Strict cookie
 *  problem where cookies are dropped in a cross-site redirect chain. */
function htmlRedirect(destination: string, status: 'success' | 'error', message: string) {
    // On error: show a readable page that does NOT auto-redirect, so the user can read the error.
    // On success: auto-redirect immediately via JS.
    const autoRedirect = status === 'success'
        ? `<p>Redirecting to your settings…</p>
    <a href="${destination}">Click here if not redirected</a>
  </div>
  <script>window.location.replace("${destination}");</script>`
        : `<p style="color:#ef4444;font-size:.8rem;word-break:break-all;margin-top:.75rem">${message}</p>
    <a href="${destination}" style="display:inline-block;margin-top:1rem;padding:.5rem 1.25rem;background:#3b82f6;color:white;border-radius:8px;text-decoration:none;font-size:.9rem">Back to Settings</a>
  </div>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${status === 'success' ? 'Connected!' : 'Connection Failed'}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0; background: #f9fafb; }
    .box { text-align: center; padding: 2rem; background: white; border-radius: 12px;
           box-shadow: 0 1px 8px rgba(0,0,0,.1); max-width: 480px; }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">${status === 'success' ? '✅' : '❌'}</div>
    <strong>${status === 'success' ? message : 'Connection Failed'}</strong>
    ${autoRedirect}
</body>
</html>`;
    return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
    });
}

/**
 * GET /api/auth/facebook/callback
 *
 * Handles the Facebook OAuth callback.
 * Exchanges the auth code for an access token, fetches pages, saves to DB.
 * Returns an HTML page that JS-navigates back to /dashboard/settings to avoid
 * SameSite cookie issues with 302 redirect chains from cross-site origins.
 */
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const fbError = url.searchParams.get('error');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

    const successDest = `${baseUrl}/dashboard/settings?fb_success=1`;
    const errorDest = (err: string) => `${baseUrl}/dashboard/settings?fb_error=${err}`;

    // User cancelled
    if (fbError) {
        console.log('[FB CALLBACK] User cancelled authorization');
        return htmlRedirect(errorDest('cancelled'), 'error', 'Facebook authorization was cancelled.');
    }

    if (!code || !state) {
        return htmlRedirect(errorDest('missing_params'), 'error', 'Missing parameters from Facebook.');
    }

    // Decode and validate state
    let businessId: string;
    try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        businessId = decoded.businessId;
        if (!businessId || Date.now() - decoded.ts > 15 * 60 * 1000) {
            throw new Error('State expired or invalid');
        }
    } catch (err) {
        console.error('[FB CALLBACK] Invalid state:', err);
        return htmlRedirect(errorDest('invalid_state'), 'error', 'Authorization session expired. Please try again.');
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!;
    const appSecret = process.env.FB_APP_SECRET!;
    const redirectUri = `${baseUrl}/api/auth/facebook/callback`;

    if (!appSecret) {
        console.error('[FB CALLBACK] FB_APP_SECRET is not set');
        return htmlRedirect(errorDest('server_config_error'), 'error', 'Server configuration error.');
    }

    // Step 1: Exchange auth code for short-lived user access token
    const tokenUrl = `${GRAPH_API_BASE}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;

    console.log('[FB CALLBACK] Exchanging code for token...');
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
        console.error('[FB CALLBACK] Token exchange failed:', tokenData);
        return htmlRedirect(errorDest('token_exchange_failed'), 'error', `Token exchange failed: ${tokenData.error?.message || 'Unknown error'}`);
    }

    const shortLivedToken: string = tokenData.access_token;
    console.log('[FB CALLBACK] Got short-lived user access token');

    // Step 2: Exchange for long-lived user access token (valid 60 days → page tokens never expire)
    const longLivedUrl = `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json();

    const userAccessToken: string = longLivedData.access_token || shortLivedToken;
    if (longLivedData.access_token) {
        console.log('[FB CALLBACK] Upgraded to long-lived token ✅');
    } else {
        console.warn('[FB CALLBACK] Long-lived token exchange failed, using short-lived token:', longLivedData.error?.message);
    }

    // Strategy 1: /me/accounts — works for pages administered directly via personal profile
    let pages: any[] = [];

    console.log('[FB CALLBACK] Fetching pages via /me/accounts...');
    const pagesRes = await fetch(
        `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,category&access_token=${userAccessToken}`
    );
    const pagesData = await pagesRes.json();
    console.log('[FB CALLBACK] /me/accounts response:', JSON.stringify(pagesData));

    if (pagesRes.ok && !pagesData.error) {
        pages = pagesData.data || [];
    }

    // Strategy 2: Business Manager API — for pages managed via Meta Business Suite
    if (pages.length === 0) {
        console.log('[FB CALLBACK] No pages via /me/accounts — trying Business Manager API...');

        const bizRes = await fetch(
            `${GRAPH_API_BASE}/me/businesses?fields=id,name&access_token=${userAccessToken}`
        );
        const bizData = await bizRes.json();
        console.log('[FB CALLBACK] /me/businesses:', JSON.stringify(bizData));

        for (const biz of (bizData.data || [])) {
            // Try owned_pages
            const ownedRes = await fetch(
                `${GRAPH_API_BASE}/${biz.id}/owned_pages?fields=id,name,category&access_token=${userAccessToken}`
            );
            const ownedData = await ownedRes.json();
            console.log(`[FB CALLBACK] /${biz.id}/owned_pages:`, JSON.stringify(ownedData));

            for (const p of (ownedData.data || [])) {
                // Exchange user token for page access token
                const ptRes = await fetch(
                    `${GRAPH_API_BASE}/${p.id}?fields=id,name,access_token,category&access_token=${userAccessToken}`
                );
                const ptData = await ptRes.json();
                pages.push({ ...p, access_token: ptData.access_token });
            }

            // If no owned pages, try client_pages
            if (pages.length === 0) {
                const clientRes = await fetch(
                    `${GRAPH_API_BASE}/${biz.id}/client_pages?fields=id,name,category&access_token=${userAccessToken}`
                );
                const clientData = await clientRes.json();
                console.log(`[FB CALLBACK] /${biz.id}/client_pages:`, JSON.stringify(clientData));

                for (const p of (clientData.data || [])) {
                    const ptRes = await fetch(
                        `${GRAPH_API_BASE}/${p.id}?fields=id,name,access_token,category&access_token=${userAccessToken}`
                    );
                    const ptData = await ptRes.json();
                    pages.push({ ...p, access_token: ptData.access_token });
                }
            }

            if (pages.length > 0) break;
        }
    }

    if (pages.length === 0) {
        console.warn('[FB CALLBACK] No pages found via any approach');
        return htmlRedirect(
            errorDest('no_pages'),
            'error',
            'No Facebook Pages found. Make sure you selected a Page during authorization.'
        );
    }

    console.log(`[FB CALLBACK] Found ${pages.length} page(s):`, pages.map(p => p.name));

    const page = pages[0];
    if (!page.access_token) {
        console.error('[FB CALLBACK] Page found but no access token available:', page.name);
        return htmlRedirect(errorDest('pages_fetch_failed'), 'error', 'Found your page but could not retrieve its access token. Ensure pages_show_list permission is granted.');
    }

    // Save to database
    const supabase = getSupabaseClient();
    const { error: dbError } = await (supabase.from('businesses') as any)
        .update({
            fb_page_id: page.id,
            fb_page_access_token: page.access_token,
            fb_page_name: page.name,
        })
        .eq('id', businessId);

    if (dbError) {
        console.error('[FB CALLBACK] DB update failed:', JSON.stringify(dbError));
        return htmlRedirect(
            errorDest('db_error'),
            'error',
            `DB save failed: ${dbError.message || dbError.code || JSON.stringify(dbError)}`
        );
    }

    console.log('[FB CALLBACK] ✅ Saved page to DB:', page.name);

    // Subscribe to webhooks (non-fatal)
    const subscribed = await subscribePageToWebhook(
        page.id,
        page.access_token,
        ['messages', 'messaging_postbacks']
    );
    if (!subscribed) console.warn('[FB CALLBACK] ⚠️ Webhook subscription failed');

    console.log('[FB CALLBACK] ✅ Facebook page connected successfully');
    return htmlRedirect(successDest, 'success', `"${page.name}" connected successfully!`);
}
