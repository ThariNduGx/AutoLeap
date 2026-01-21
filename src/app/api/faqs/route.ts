import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { storeFAQ } from '@/lib/infrastructure/embeddings';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/faqs
 * 
 * Fetch FAQs for the authenticated business user ONLY
 * SECURITY: Business ID comes from session, NOT from request
 */
export async function GET(req: NextRequest) {
    const session = await getSession(req);

    if (!session || !hasRole(session, 'business')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = session.businessId;

    if (!businessId) {
        return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await (supabase
        .from('faq_documents') as any)
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
}

/**
 * POST /api/faqs
 * 
 * Add a new FAQ for the authenticated business user ONLY
 * SECURITY: Business ID comes from session, NOT from request
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession(req);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const businessId = session.businessId;

        if (!businessId) {
            return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
        }

        const body = await req.json();
        const { question, answer, category } = body;

        if (!question || !answer) {
            return NextResponse.json({ error: 'Question and Answer required' }, { status: 400 });
        }

        // Store FAQ with business ID from session (secure!)
        const success = await storeFAQ(businessId, question, answer, category || 'general');

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Failed to store FAQ' }, { status: 500 });
        }
    } catch (error) {
        console.error('[FAQ POST] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * DELETE /api/faqs
 * 
 * Delete an FAQ for the authenticated business user ONLY
 * SECURITY: Verifies FAQ belongs to user's business before deleting
 */
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession(req);

        if (!session || !hasRole(session, 'business')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const businessId = session.businessId;

        if (!businessId) {
            return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        const supabase = getSupabaseClient();

        // CRITICAL SECURITY: Verify FAQ belongs to this business
        const { data: exists } = await (supabase.from('faq_documents') as any)
            .select('id')
            .eq('id', id)
            .eq('business_id', businessId)
            .single();

        if (!exists) {
            return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
        }

        // Delete only if ownership verified
        const { error } = await (supabase
            .from('faq_documents') as any)
            .delete()
            .eq('id', id)
            .eq('business_id', businessId); // Double-check in delete too

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[FAQ DELETE] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
