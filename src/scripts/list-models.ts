
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listModels() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('No API KEY');
        return;
    }

    console.log('Fetching models from REST API...');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
            console.error('API Error:', data);
            return;
        }

        console.log('Available Models:');
        (data.models || []).forEach((m: any) => {
            if (m.supportedGenerationMethods?.includes('generateContent')) {
                console.log(` - ${m.name}`);
            }
        });
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

listModels();
