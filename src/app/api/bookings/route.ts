
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId') || process.env.DEFAULT_BUSINESS_ID;

    if (!businessId) {
        return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await (supabase
        .from('appointments') as any)
        .select('*')
        .eq('business_id', businessId)
        .order('start_time', { ascending: false }); // Show newest first

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
