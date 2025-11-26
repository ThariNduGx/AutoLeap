import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/database/supabase';

// 1. FORCE EDGE RUNTIME
// This makes the function start instantly (0ms) and cost almost nothing.
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // 2. SECURITY: HMAC CHECK
    // We reject unauthorized requests immediately.
    // Ensure 'TELEGRAM_SECRET_TOKEN' is set in your .env.local
    const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 3. SIZE CHECK (DDoS Protection)
    // Reject massive payloads (Telegram text is rarely > 8KB)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 8192) {
       return new NextResponse(JSON.stringify({ error: 'Payload Too Large' }), { status: 413 });
    }

    // 4. PARSE DATA
    const body = await req.json();
    
    // Ignore updates that aren't messages (like typing indicators)
    if (!body.message && !body.edited_message) {
      return new NextResponse('OK');
    }

    // 5. DATABASE INGESTION (The "Air Gap")
    // We send the data to Supabase. We do NOT call OpenAI here.
    const supabase = createSupabaseClient();
    
    const { error } = await supabase
      .from('request_queue')
      .insert({
        business_id: process.env.DEFAULT_BUSINESS_ID, // Temporary ID from .env
        raw_payload: body,
        status: 'pending'
      });

    if (error) {
      console.error('Queue Error:', error);
      // We still return 200 to Telegram so it doesn't keep retrying
      return new NextResponse('Database Error', { status: 200 }); 
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}