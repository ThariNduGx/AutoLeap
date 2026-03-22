import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

const ALLOWED_KEYS = ['default_monthly_budget_usd', 'default_ai_model', 'global_announcement'] as const;
type SettingKey = typeof ALLOWED_KEYS[number];

/**
 * GET /api/admin/settings
 * Returns all platform-level settings. Admin-only.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);
        if (!session || !hasRole(session, 'admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabase = getSupabaseClient();
        const { data, error } = await (supabase
            .from('platform_settings') as any)
            .select('key, value')
            .in('key', ALLOWED_KEYS);

        if (error) {
            console.error('[ADMIN SETTINGS] Fetch error:', error);
            return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
        }

        // Convert row array to object map
        const settings: Record<string, string> = {};
        for (const row of (data ?? [])) {
            settings[row.key] = row.value ?? '';
        }

        return NextResponse.json({ success: true, settings });
    } catch (err) {
        console.error('[ADMIN SETTINGS] GET exception:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/settings
 * Update one or more platform settings. Admin-only.
 * Body: { key: string, value: string }[]
 */
export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession(request);
        if (!session || !hasRole(session, 'admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const updates: { key: string; value: string }[] = Array.isArray(body) ? body : [body];

        // Validate keys
        for (const update of updates) {
            if (!ALLOWED_KEYS.includes(update.key as SettingKey)) {
                return NextResponse.json({ error: `Invalid key: ${update.key}` }, { status: 400 });
            }
        }

        const supabase = getSupabaseClient();
        const now = new Date().toISOString();

        for (const update of updates) {
            const { error } = await (supabase
                .from('platform_settings') as any)
                .upsert({ key: update.key, value: String(update.value), updated_at: now });

            if (error) {
                console.error('[ADMIN SETTINGS] Upsert error:', error);
                return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[ADMIN SETTINGS] PATCH exception:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
