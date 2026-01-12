
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing in .env.local');
    process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

let offset = 0;

async function poll() {
    console.log('📡 Polling Telegram for updates...');

    while (true) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=50`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                console.error(`Status ${res.status}: ${res.statusText}`);
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            const data = await res.json();

            if (!data.ok) {
                console.error('Telegram API Error:', data);
                continue;
            }

            for (const update of data.result) {
                console.log(`📩 Received Update ID: ${update.update_id}`);

                // Push to Request Queue
                const { error } = await supabase
                    .from('request_queue')
                    .insert({
                        business_id: process.env.DEFAULT_BUSINESS_ID,
                        raw_payload: update,
                        status: 'pending'
                    });

                if (error) {
                    console.error('❌ Supabase Insert Error:', error);
                } else {
                    console.log('✅ Queued successfully');
                    // Auto-process for dev convenience
                    try {
                        const { processQueue } = await import('@/lib/core/queue-processor');
                        await processQueue();
                        console.log('🤖 Processed item.');
                    } catch (e) {
                        console.error('Processor Error:', e);
                    }
                }

                // Advance offset
                offset = update.update_id + 1;
            }

        } catch (err) {
            console.error('Polling Error:', err);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

poll();
