
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId') || process.env.DEFAULT_BUSINESS_ID;

    const supabase = getSupabaseClient();

    const { data, error } = await (supabase
        .from('businesses') as any)
        .select('*')
        .eq('id', businessId)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, phone, description, business_hours, businessId } = body;
        const bid = businessId || process.env.DEFAULT_BUSINESS_ID;

        const supabase = getSupabaseClient();

        const { error } = await (supabase
            .from('businesses') as any)
            .update({
                name,
                phone,
                description,
                business_hours // assuming JSONB
            })
            .eq('id', bid);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
