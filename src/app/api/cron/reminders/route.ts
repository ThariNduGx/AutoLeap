import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/infrastructure/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/cron/reminders
 *
 * Runs every 30 minutes.
 * 1. Sends Telegram appointment reminders using each business's custom reminder_hours schedule.
 * 2. Sends post-appointment review requests (2h after service ends) for Telegram customers.
 *
 * reminder_hours: JSONB array on businesses table, e.g. [48, 24, 2, 1].
 * reminders_sent: JSONB map on appointments, e.g. { "48": true, "24": false }.
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return new NextResponse('CRON_SECRET not set', { status: 500 });

    const isValid =
      req.headers.get('authorization') === `Bearer ${cronSecret}` ||
      searchParams.get('key') === cronSecret;
    if (!isValid) return new NextResponse('Unauthorized', { status: 401 });

    console.log('[REMINDERS] Starting reminder + review check...');
    const supabase = getSupabaseClient();

    const { data: businesses } = await (supabase.from('businesses') as any)
      .select('id, name, telegram_bot_token, timezone, reminder_hours')
      .not('telegram_bot_token', 'is', null);

    if (!businesses?.length) return NextResponse.json({ success: true, sent: 0 });

    let totalSent = 0;

    for (const biz of businesses) {
      const tz: string = biz.timezone || 'Asia/Colombo';
      const reminderHours: number[] = Array.isArray(biz.reminder_hours) ? biz.reminder_hours : [24, 1];

      const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));

      // ── Appointment reminders ────────────────────────────────────────────────
      // Fetch all scheduled appointments in a +48h window (covers any custom reminder schedule)
      const windowEnd = new Date(nowLocal.getTime() + Math.max(...reminderHours) * 3_600_000 + 2 * 3_600_000);
      const windowStart = nowLocal.toLocaleDateString('en-CA');
      const windowEndDate = windowEnd.toLocaleDateString('en-CA');

      const { data: appointments } = await (supabase.from('appointments') as any)
        .select('id, customer_name, customer_chat_id, service_type, appointment_date, appointment_time, platform, reminders_sent, duration_minutes')
        .eq('business_id', biz.id)
        .eq('status', 'scheduled')
        .gte('appointment_date', windowStart)
        .lte('appointment_date', windowEndDate);

      for (const appt of appointments || []) {
        const sentMap: Record<string, boolean> = appt.reminders_sent || {};
        const [apptH, apptM] = appt.appointment_time.split(':').map(Number);

        // Parse appointment local datetime
        const apptLocal = new Date(nowLocal);
        apptLocal.setFullYear(
          ...appt.appointment_date.split('-').map(Number) as [number, number, number]
        );
        apptLocal.setHours(apptH, apptM, 0, 0);

        const minutesUntil = (apptLocal.getTime() - nowLocal.getTime()) / 60_000;

        for (const hoursAhead of reminderHours) {
          const key = String(hoursAhead);
          if (sentMap[key]) continue; // already sent

          const targetMinutes = hoursAhead * 60;
          // Window: within ±25 minutes of the target (covers 30-min cron cadence)
          const inWindow = minutesUntil >= (targetMinutes - 25) && minutesUntil <= (targetMinutes + 25);
          if (!inWindow) continue;

          const label = hoursAhead >= 24
            ? `${hoursAhead / 24} day${hoursAhead / 24 !== 1 ? 's' : ''}`
            : `${hoursAhead} hour${hoursAhead !== 1 ? 's' : ''}`;

          const sent = await sendReminderToCustomer(
            biz.telegram_bot_token, appt, biz.name, label
          );

          if (sent) {
            sentMap[key] = true;
            await (supabase.from('appointments') as any)
              .update({ reminders_sent: sentMap })
              .eq('id', appt.id);
            totalSent++;
            console.log(`[REMINDERS] ✅ ${hoursAhead}h reminder sent: appt ${appt.id}`);
          }
        }
      }

      // ── Post-appointment review requests ──────────────────────────────────
      // Find completed/past scheduled appointments whose end_time + 2h ≈ now
      // and where review_requested_at is null and platform = telegram
      const twoHoursAgo = new Date(nowLocal.getTime() - 2 * 3_600_000);
      const todayStr    = nowLocal.toLocaleDateString('en-CA');

      const { data: pastAppts } = await (supabase.from('appointments') as any)
        .select('id, customer_name, customer_chat_id, service_type, appointment_date, appointment_time, duration_minutes, platform, review_requested_at')
        .eq('business_id', biz.id)
        .eq('status', 'scheduled')
        .lte('appointment_date', todayStr)
        .is('review_requested_at', null);

      for (const appt of pastAppts || []) {
        if (appt.platform !== 'telegram') continue;
        if (!appt.customer_chat_id) continue;

        const [h, m] = appt.appointment_time.split(':').map(Number);
        const apptEnd = new Date(nowLocal);
        apptEnd.setFullYear(...appt.appointment_date.split('-').map(Number) as [number, number, number]);
        apptEnd.setHours(h, m + (appt.duration_minutes || 60), 0, 0);

        const minutesSinceEnd = (nowLocal.getTime() - apptEnd.getTime()) / 60_000;
        // Send when 90–150 minutes after end (2h ± 30min window)
        if (minutesSinceEnd < 90 || minutesSinceEnd > 150) continue;

        const sent = await sendReviewRequest(biz.telegram_bot_token, appt, biz.name);
        if (sent) {
          await (supabase.from('appointments') as any)
            .update({ review_requested_at: new Date().toISOString() })
            .eq('id', appt.id);
          totalSent++;
          console.log(`[REMINDERS] ⭐ Review request sent: appt ${appt.id}`);
        }
      }
    }

    console.log(`[REMINDERS] ✅ Sent ${totalSent} messages`);
    return NextResponse.json({ success: true, sent: totalSent, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('[REMINDERS] Fatal error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) { return GET(req); }

// ─────────────────────────────────────────────────────────────────────────────

async function sendReminderToCustomer(
  botToken: string,
  appt: { id: string; customer_name: string; customer_chat_id: string; service_type: string; appointment_date: string; appointment_time: string; platform?: string },
  businessName: string,
  timeUntil: string
): Promise<boolean> {
  const platform = appt.platform || 'telegram';
  if (platform !== 'telegram') return false;
  if (!appt.customer_chat_id || appt.customer_chat_id === 'unknown') return false;

  const msg =
    `⏰ *Appointment Reminder*\n\n` +
    `Hi ${appt.customer_name}! Your appointment is in *${timeUntil}*.\n\n` +
    `📋 *${appt.service_type}*\n` +
    `📅 ${appt.appointment_date}\n` +
    `🕐 ${appt.appointment_time}\n\n` +
    `📍 *${businessName}*\n\nPlease confirm or cancel below.`;

  return sendTelegramMessage(botToken, appt.customer_chat_id, msg, {
    inline_keyboard: [[
      { text: '✅ Confirm', callback_data: `confirm_appt:${appt.id}` },
      { text: '❌ Cancel',  callback_data: `cancel_appt:${appt.id}` },
    ]],
  });
}

async function sendReviewRequest(
  botToken: string,
  appt: { id: string; customer_name: string; customer_chat_id: string; service_type: string },
  businessName: string
): Promise<boolean> {
  if (!appt.customer_chat_id || appt.customer_chat_id === 'unknown') return false;

  const msg =
    `⭐ *How was your experience?*\n\n` +
    `Hi ${appt.customer_name}! We hope you enjoyed your *${appt.service_type}* at ${businessName}.\n` +
    `We'd love your feedback — please rate your experience:`;

  return sendTelegramMessage(botToken, appt.customer_chat_id, msg, {
    inline_keyboard: [[
      { text: '⭐ 1', callback_data: `review:${appt.id}:1` },
      { text: '⭐⭐ 2', callback_data: `review:${appt.id}:2` },
      { text: '⭐⭐⭐ 3', callback_data: `review:${appt.id}:3` },
      { text: '⭐⭐⭐⭐ 4', callback_data: `review:${appt.id}:4` },
      { text: '⭐⭐⭐⭐⭐ 5', callback_data: `review:${appt.id}:5` },
    ]],
  });
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: object
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:      chatId,
        text,
        parse_mode:   'Markdown',
        reply_markup: replyMarkup,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(`[REMINDERS] Telegram send failed (${chatId}):`, data.description);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[REMINDERS] Network error:', err);
    return false;
  }
}
