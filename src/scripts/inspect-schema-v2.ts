
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function inspect() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    console.log('--- Inspecting Table Columns ---');

    const { data: cols, error: err2 } = await (supabase.from('faq_embeddings') as any).select('*').limit(5);
    if (err2) {
        console.error('Error selecting embeddings:', err2);
        return;
    }

    console.log(`Found ${cols.length} rows.`);
    if (cols.length > 0) {
        const row = cols[0];
        console.log('Keys:', Object.keys(row));

        if (row.embedding) console.log(' - embedding (OpenAI) length:', row.embedding.length); // 1536 or string?
        if (row.embedding_gemini) console.log(' - embedding_gemini (Gemini) length:', row.embedding_gemini.length);

        // Check specific FAQ logic
        console.log('--- Checking FAQs vs Embeddings ---');
        const { data: docs } = await (supabase
            .from('faq_documents')
            .select('id, question, faq_embeddings(embedding_gemini)'));

        docs?.forEach((d: any) => {
            const hasEmbedding = d.faq_embeddings && d.faq_embeddings.length > 0 && d.faq_embeddings[0].embedding_gemini;
            console.log(`[${hasEmbedding ? '✅' : '❌'}] ${d.question}`);
        });
    } else {
        console.log('Table is empty.');
    }
}

inspect();
