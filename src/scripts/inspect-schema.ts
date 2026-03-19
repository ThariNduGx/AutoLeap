
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function inspect() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Query to get function definition
    const { data, error } = await supabase.rpc('get_function_def', { func_name: 'match_faqs' });

    // Since we probably don't have a 'get_function_def' RPC, 
    // let's try to just SELECT from the faq_documents and faq_embeddings to see columns.

    console.log('--- Inspecting Table Columns ---');

    const { data: cols, error: err2 } = await (supabase.from('faq_embeddings') as any).select('*').limit(1);
    if (err2) console.error('Error selecting embeddings:', err2);
    else {
        const keys = Object.keys(cols[0] || {});
        console.log('Columns in faq_embeddings:', keys);

        // Check if embedding_gemini is populated
        if (cols.length > 0) {
            console.log('Sample Data:');
            if (cols[0].embedding) console.log(' - embedding (OpenAI) length:', cols[0].embedding.length);
            if (cols[0].embedding_gemini) console.log(' - embedding_gemini (Gemini) length:', cols[0].embedding_gemini.length);
        }
    }

    console.log('\n--- Inspecting match_faqs (inferred) ---');
    // We can't see the code, but we can verify our search logic in 'embeddings.ts'
}

inspect();
