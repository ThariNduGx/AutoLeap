import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { storeFAQ, generateEmbedding } from '@/lib/infrastructure/embeddings';
import { getSession, hasRole } from '@/lib/auth/session';
import { rateLimit } from '@/lib/infrastructure/rate-limit';

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
    // 30 FAQ adds per minute per IP
    const rl = await rateLimit(req, 'api/faqs/post', { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

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
 * PUT /api/faqs
 *
 * Update an existing FAQ. Regenerates the embedding for the updated content.
 * SECURITY: Verifies FAQ belongs to user's business before updating.
 */
export async function PUT(req: NextRequest) {
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
        const { id, question, answer, category } = body;

        if (!id || !question || !answer) {
            return NextResponse.json({ error: 'id, question, and answer are required' }, { status: 400 });
        }

        const supabase = getSupabaseClient();

        // SECURITY: Verify FAQ belongs to this business before updating
        const { data: existing } = await (supabase.from('faq_documents') as any)
            .select('id')
            .eq('id', id)
            .eq('business_id', businessId)
            .single();

        if (!existing) {
            return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
        }

        // Update the FAQ document
        const { error: updateError } = await (supabase.from('faq_documents') as any)
            .update({ question, answer, category: category || 'general' })
            .eq('id', id)
            .eq('business_id', businessId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Regenerate embedding for updated content (non-fatal — FAQ is usable without it)
        try {
            const textToEmbed = `${question} ${answer}`;
            const embedding = await generateEmbedding(textToEmbed, businessId);

            if (embedding) {
                const isGemini = process.env.USE_GEMINI_FOR_DEV === 'true';
                const embeddingColumn = isGemini ? 'embedding_gemini' : 'embedding';

                // Replace the existing embedding row (CASCADE ensures old row was not orphaned)
                await (supabase.from('faq_embeddings') as any)
                    .delete()
                    .eq('faq_id', id);

                await (supabase.from('faq_embeddings') as any)
                    .insert({ faq_id: id, [embeddingColumn]: embedding });
            }
        } catch {
            // Embedding regeneration is non-fatal
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[FAQ PUT] Error:', error);
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
