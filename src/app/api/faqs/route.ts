
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { storeFAQ } from '@/lib/infrastructure/embeddings';

export const dynamic = 'force-dynamic';

// GET /api/faqs - Fetch all FAQs for the business
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId') || process.env.DEFAULT_BUSINESS_ID;

    if (!businessId) {
        return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
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

    return NextResponse.json(data);
}

// POST /api/faqs - Add a new FAQ (and generate embedding)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { question, answer, category, businessId } = body;
        const bid = businessId || process.env.DEFAULT_BUSINESS_ID;

        if (!question || !answer) {
            return NextResponse.json({ error: 'Question and Answer required' }, { status: 400 });
        }

        // Use the existing helper to handle embedding generation
        const success = await storeFAQ(bid, question, answer, category || 'general');

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Failed to store FAQ' }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/faqs - Delete an FAQ
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const businessId = searchParams.get('businessId') || process.env.DEFAULT_BUSINESS_ID; // Security check needed

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const supabase = getSupabaseClient();

        // Verify ownership
        const { data: exists } = await (supabase.from('faq_documents') as any)
            .select('id')
            .eq('id', id)
            .eq('business_id', businessId)
            .single();

        if (!exists) {
            return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
        }

        const { error } = await (supabase
            .from('faq_documents') as any)
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
