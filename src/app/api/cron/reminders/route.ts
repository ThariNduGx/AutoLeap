import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/cron/reminders
 *
 * Appointment reminder cron job — runs every 30 minutes.
 * Sends Telegram reminders to customers:
 *   - 24h before their appointment  (reminder_24h_sent flag)
 *   - 1h  before their appointment  (reminder_1h_sent  flag)
 *
 * Each business can use its own timezone because appointment_date +
 * appointment_time are stored in local time.
 *
 * Vercel cron: add to vercel.json -> { "path": "/api/cron/reminders", "schedule": "*/30 * * * *" }
 */
export async function GET(req: Request) {
  try {
    // Auth
    const { searchParams } = new URL(req.url);
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return new NextResponse('CRON_SECRET not set', { status: 500 });
    }
    const isValid =
      req.headers.get('authorization') === `Bearer ${cronSecret}` ||
      searchParams.get('key') === cronSecret;

    if (!isValid) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('[REMINDERS] Starting reminder check...');
    const supabase = getSupabaseClient();

    // Fetch all businesses that have a Telegram bot token configured
    const { data: businesses } = await (supabase
      .from('businesses') as any)
      .select('id, name, telegram_bot_token, timezone')
      .not('telegram_bot_token', 'is', null);

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    let totalSent = 0;

    for (const biz of businesses) {
      const tz: string = biz.timezone || 'Asia/Colombo';

      // Current local time for this business
      const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
      const todayLocal = nowLocal.toLocaleDateString('en-CA'); // YYYY-MM-DD

      // Tomorrow's local date
      const tomorrowLocal = new Date(nowLocal);
      tomorrowLocal.setDate(tomorrowLocal.getDate() + 1);
      const tomorrowStr = tomorrowLocal.toLocaleDateString('en-CA');

      // ── 24-HOUR REMINDERS ────────────────────────────────
      // Find tomorrow's scheduled appointments where 24h reminder not yet sent
      const { data: upcoming24h } = await (supabase
        .from('appointments') as any)
        .select('id, customer_name, customer_chat_id, service_type, appointment_date, appointment_time, platform')
        .eq('business_id', biz.id)
        .eq('status', 'scheduled')
        .eq('appointment_date', tomorrowStr)
        .eq('reminder_24h_sent', false);

      for (const appt of upcoming24h || []) {
        const sent = await sendReminderToCustomer(
          biz.telegram_bot_token,
          appt,
          biz.name,
          '24 hours'
        );
        if (sent) {
          await (supabase.from('appointments') as any)
            .update({ reminder_24h_sent: true })
            .eq('id', appt.id);
          totalSent++;
          console.log(`[REMINDERS] ✅ 24h reminder sent: appt ${appt.id}`);
        }
      }

      // ── 1-HOUR REMINDERS ─────────────────────────────────
      // Find today's appointments starting within 60–90 minutes from now,
      // where 1h reminder not yet sent
      const { data: upcoming1h } = await (supabase
        .from('appointments') as any)
        .select('id, customer_name, customer_chat_id, service_type, appointment_date, appointment_time, platform')
        .eq('business_id', biz.id)
        .eq('status', 'scheduled')
        .eq('appointment_date', todayLocal)
        .eq('reminder_1h_sent', false);

      for (const appt of upcoming1h || []) {
        // Parse appointment local time and compare to now
        const [apptHour, apptMin] = appt.appointment_time.split(':').map(Number);
        const apptLocalDate = new Date(nowLocal);
        apptLocalDate.setHours(apptHour, apptMin, 0, 0);

        const minutesUntil = (apptLocalDate.getTime() - nowLocal.getTime()) / 60_000;

        // Send when 45–95 minutes away (wider window ensures 30-min cron never misses it)
        if (minutesUntil >= 45 && minutesUntil <= 95) {
          const sent = await sendReminderToCustomer(
            biz.telegram_bot_token,
            appt,
            biz.name,
            '1 hour'
          );
          if (sent) {
            await (supabase.from('appointments') as any)
              .update({ reminder_1h_sent: true })
              .eq('id', appt.id);
            totalSent++;
            console.log(`[REMINDERS] ✅ 1h reminder sent: appt ${appt.id}`);
          }
        }
      }
    }

    console.log(`[REMINDERS] ✅ Sent ${totalSent} reminders`);
    return NextResponse.json({ success: true, sent: totalSent, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('[REMINDERS] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}

/**
 * Send a reminder message to the customer via Telegram.
 * Returns true if the message was sent successfully.
 */
async function sendReminderToCustomer(
  botToken: string,
  appt: {
    customer_name: string;
    customer_chat_id: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
    platform?: string;
  },
  businessName: string,
  timeUntil: string
): Promise<boolean> {
  // Only Telegram reminders are supported for now (Messenger doesn't support push messages)
  const platform = appt.platform || 'telegram';
  if (platform !== 'telegram') return false;

  if (!appt.customer_chat_id || appt.customer_chat_id === 'unknown') return false;

  const message =
    `⏰ *Appointment Reminder*\n\n` +
    `Hi ${appt.customer_name}! This is a reminder that your appointment is in *${timeUntil}*.\n\n` +
    `📋 *${appt.service_type}*\n` +
    `📅 ${appt.appointment_date}\n` +
    `🕐 ${appt.appointment_time}\n\n` +
    `📍 *${businessName}*\n\n` +
    `Please confirm or cancel below.`;

  // Inline keyboard: Confirm ✅ / Cancel ❌
  const replyMarkup = {
    inline_keyboard: [[
      { text: '✅ Confirm', callback_data: `confirm_appt:${appt.id}` },
      { text: '❌ Cancel', callback_data: `cancel_appt:${appt.id}` },
    ]],
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: appt.customer_chat_id,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.warn(`[REMINDERS] Telegram send failed for chat ${appt.customer_chat_id}:`, data.description);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[REMINDERS] Network error sending reminder:', err);
    return false;
  }
}
