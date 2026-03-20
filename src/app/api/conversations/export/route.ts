import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';
import { getSession, hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/export?days=30
 *
 * Export all conversations for the authenticated business as a CSV file.
 * Each row is one message turn. Supports a `days` query param (default 30).
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const businessId = session.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'No business' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30')));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = getSupabaseClient();

  const { data: conversations, error } = await (supabase
    .from('conversations') as any)
    .select('id, customer_chat_id, intent, status, created_at, last_message_at, history, state')
    .eq('business_id', businessId)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  // ── Build CSV ─────────────────────────────────────────────────────────────
  const rows: string[] = [
    'conversation_id,customer_chat_id,intent,conv_status,conv_created_at,role,message,message_sent_at,booked',
  ];

  for (const conv of conversations || []) {
    const history: any[] = conv.history || [];
    const booked = conv.state?.booked ? 'true' : 'false';

    if (history.length === 0) {
      // Include the conversation even if no history
      rows.push(csvRow([conv.id, conv.customer_chat_id, conv.intent, conv.status, conv.created_at, '', '', '', booked]));
      continue;
    }

    for (const turn of history) {
      const role: string = turn.role || '';
      if (!['user', 'model', 'owner'].includes(role)) continue;
      const text: string = turn.parts?.find((p: any) => p.text)?.text || '';
      if (!text) continue;
      const sentAt: string = turn.sent_at || conv.created_at;
      rows.push(csvRow([conv.id, conv.customer_chat_id, conv.intent, conv.status, conv.created_at, role, text, sentAt, booked]));
    }
  }

  const csv = rows.join('\n');
  const filename = `conversations-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function csvRow(fields: string[]): string {
  return fields
    .map(f => `"${String(f ?? '').replace(/"/g, '""')}"`)
    .join(',');
}
