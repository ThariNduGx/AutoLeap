import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

console.log('Testing env loading:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...');
console.log('DEFAULT_BUSINESS_ID:', process.env.DEFAULT_BUSINESS_ID);
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);