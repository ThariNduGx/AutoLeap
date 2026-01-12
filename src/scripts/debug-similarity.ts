
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugSimilarity() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    const query = "What is your business name";
    console.log(`Generating embedding for: "${query}"`);

    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(query);
    const queryInv = result.embedding.values;

    console.log('Fetching stored embeddings...');
    // Fetch all embeddings to compare
    const { data: rows } = await (supabase
        .from('faq_documents')
        .select('id, question, faq_embeddings(embedding_gemini)'));

    if (!rows) return;

    console.log('\n--- Similarity Scores (Dot Product for normalized) ---');

    for (const row of rows) {
        let emb = (row as any).faq_embeddings?.[0]?.embedding_gemini;
        if (!emb) continue;

        if (typeof emb === 'string') {
            emb = JSON.parse(emb);
        }

        // Calculate Cosine Similarity
        // Assuming vectors are normalized? Gemini vectors usually are.
        // dot product = sum(a[i] * b[i])
        let dot = 0;
        let magA = 0;
        let magB = 0;

        for (let i = 0; i < emb.length; i++) {
            dot += emb[i] * queryInv[i];
            magA += emb[i] * emb[i];
            magB += queryInv[i] * queryInv[i];
        }

        magA = Math.sqrt(magA);
        magB = Math.sqrt(magB);

        const similarity = dot / (magA * magB);

        if (similarity > 0.4) {
            console.log(`[${similarity.toFixed(4)}] ${row.question}`);
        }
    }
}

debugSimilarity();
