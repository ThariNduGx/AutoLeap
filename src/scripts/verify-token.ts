
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkToken() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const businessId = process.env.DEFAULT_BUSINESS_ID;

    if (!supabaseUrl || !supabaseKey || !businessId) {
        console.error('Missing env vars');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('businesses')
        .select('google_calendar_token')
        .eq('id', businessId)
        .single();

    if (error) {
        console.error('Error fetching business:', error);
        process.exit(1);
    }

    if (data?.google_calendar_token) {
        console.log('✅ Token found!');
        console.log('Length:', data.google_calendar_token.length);
        process.exit(0);
    } else {
        console.error('❌ No token found. Please connect calendar first.');
        process.exit(1);
    }
}

checkToken();
