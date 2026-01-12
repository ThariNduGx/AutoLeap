
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { processQueue } from '@/lib/core/queue-processor';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugQueue() {
    console.log('🔍 Debugging Queue...');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 1. Check pending items
    const { data: pending, error } = await supabase
        .from('request_queue')
        .select('*')
        .eq('status', 'pending');

    if (error) {
        console.error('❌ Error fetching queue:', error);
        return;
    }

    console.log(`📊 Pending Items: ${pending?.length}`);
    if (pending?.length > 0) {
        pending.forEach(p => {
            console.log(` - [${p.id}] Payload:`, JSON.stringify(p.raw_payload).substring(0, 50) + '...');
        });

        console.log('\n🚀 Running Processor...');
        await processQueue();
    } else {
        console.log('⚠️ No pending items. The webhook might not have received the message.');

        // Check recent failed/completed
        const { data: recent } = await supabase
            .from('request_queue')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        console.log('\nRecent items:');
        recent?.forEach(p => console.log(` - [${p.status}] ${p.id}`));
    }
}

debugQueue();
