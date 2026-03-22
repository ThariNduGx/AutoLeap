import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/conversations/[id]/reply
 *
 * Send a manual reply from the business owner to a customer in human-mode.
 * Routes the message to the correct platform (Telegram or Messenger).
 *
 * Body: { message: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const businessId = session.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'No business' }, { status: 400 });
  }

  const body = await req.json();
  const message: string = (body.message || '').trim();

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  if (message.length > 4000) {
    return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 });
  }

  const { id: convId } = await params;
  const supabase = getSupabaseClient();

  // Fetch conversation, verifying it belongs to this business
  const { data: conv } = await (supabase
    .from('conversations') as any)
    .select('id, customer_chat_id, platform, status, business_id')
    .eq('id', convId)
    .eq('business_id', businessId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Only allow replies on human/escalated conversations
  if (conv.status !== 'human' && conv.status !== 'escalated') {
    return NextResponse.json(
      { error: 'Can only reply to conversations in human or escalated mode' },
      { status: 409 }
    );
  }

  const platform: string = conv.platform || 'telegram';
  const chatId: string = conv.customer_chat_id;

  let sent = false;

  if (platform === 'telegram') {
    const { data: biz } = await (supabase
      .from('businesses') as any)
      .select('telegram_bot_token')
      .eq('id', businessId)
      .single();

    if (!biz?.telegram_bot_token) {
      return NextResponse.json({ error: 'Telegram not connected' }, { status: 422 });
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${biz.telegram_bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          // No parse_mode: owner messages are plain conversational text.
          // Applying 'Markdown' causes Telegram to reject any message with
          // an unbalanced *, _, `, or [ — silently dropping the reply.
        }),
      }
    );

    const tgData = await tgRes.json();
    sent = tgData.ok === true;

    if (!sent) {
      console.error('[REPLY] Telegram send failed:', tgData.description);
    }

  } else if (platform === 'messenger') {
    const { data: biz } = await (supabase
      .from('businesses') as any)
      .select('fb_page_access_token')
      .eq('id', businessId)
      .single();

    if (!biz?.fb_page_access_token) {
      return NextResponse.json({ error: 'Facebook not connected' }, { status: 422 });
    }

    const { sendMessengerMessage } = await import('@/lib/infrastructure/messenger');
    sent = await sendMessengerMessage(biz.fb_page_access_token, {
      recipientId: chatId,
      text: message,
      messagingType: 'RESPONSE',
    });
  }

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 502 });
  }

  // Append the owner's reply to the conversation history so it's visible in the dashboard
  const { data: latest } = await (supabase
    .from('conversations') as any)
    .select('history')
    .eq('id', convId)
    .eq('business_id', businessId)
    .single();

  const history: any[] = latest?.history || [];
  history.push({
    role: 'owner',
    parts: [{ text: message }],
    sent_at: new Date().toISOString(),
  });

  await (supabase
    .from('conversations') as any)
    .update({
      history,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', convId)
    .eq('business_id', businessId);

  console.log(`[REPLY] ✅ Owner replied to ${platform} chat ${chatId}`);
  return NextResponse.json({ success: true });
}
