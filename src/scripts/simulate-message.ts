
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function simulate() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Create a fake Telegram payload
    const payload = {
        update_id: 123456789,
        message: {
            message_id: 999,
            from: {
                id: 12345, // Fake user ID
                is_bot: false,
                first_name: "Test",
                username: "testuser",
                language_code: "en"
            },
            chat: {
                id: 12345, // Fake chat ID
                first_name: "Test",
                username: "testuser",
                type: "private"
            },
            date: Math.floor(Date.now() / 1000),
            text: "Do you accept credit cards?" // The question the user asked
        }
    };

    const { data, error } = await supabase
        .from('request_queue')
        .insert({
            business_id: process.env.DEFAULT_BUSINESS_ID,
            raw_payload: payload,
            status: 'pending'
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to insert:', error);
    } else {
        console.log('✅ Inserted simulation item:', data.id);
        console.log('Run the debug-queue script again to process it.');
    }
}

simulate();
