import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getSupabaseClient } from './supabase';
import { redis } from './redis';

/**
 * Returns an ISO 8601 UTC offset string (e.g. "+05:30") for the given IANA
 * timezone and date. Falls back to "+05:30" (Asia/Colombo) on any error.
 */
function getTzOffset(timezone: string, date: string): string {
  try {
    // Use Intl to get the UTC offset at noon on the given date
    const testDate = new Date(`${date}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(testDate);

    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    // offsetPart is like "GMT+5:30" or "GMT-8"
    const match = offsetPart.match(/GMT([+-]\d{1,2}(?::\d{2})?)/);
    if (match) {
      const raw = match[1]; // e.g. "+5:30" or "-8"
      const [h, m = '00'] = raw.slice(1).split(':');
      const sign = raw[0];
      return `${sign}${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }
    return '+05:30';
  } catch {
    return '+05:30';
  }
}

const calendar = google.calendar('v3');

/**
 * Invalidate all availability cache entries for a given business + date.
 * The cache key includes service-specific suffixes (durationMinutes:bufferMinutes),
 * so a plain redis.del() on the base key would leave stale entries. This helper
 * scans with a wildcard and deletes every matching key.
 */
async function invalidateAvailabilityCache(businessId: string, date: string): Promise<void> {
  try {
    const pattern = `calendar:availability:${businessId}:${date}:*`;
    const keys = await redis.keys(pattern);
    // Also delete the base key (written by minAdvanceHours===0 paths without suffix)
    const baseKey = `calendar:availability:${businessId}:${date}`;
    const allKeys = Array.from(new Set([...keys, baseKey]));
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
      console.log('[CALENDAR] 🧹 Cache invalidated for', date, `(${allKeys.length} key(s))`);
    }
  } catch (err) {
    console.warn('[CALENDAR] Cache invalidation failed (non-fatal):', err);
  }
}

/**
 * Get OAuth2 client for a business
 */
interface BusinessCalendarConfig {
  google_calendar_token: string | null;
  timezone: string;
}

async function getBusinessCalendarConfig(businessId: string): Promise<BusinessCalendarConfig | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await (supabase
    .from('businesses')
    .select('google_calendar_token, timezone')
    .eq('id', businessId)
    .single() as any);
  if (error || !data) return null;
  return data;
}

async function getOAuth2Client(businessId: string): Promise<OAuth2Client | null> {
  const supabase = getSupabaseClient();

  // Get stored tokens from database
  const { data: business, error } = await (supabase
    .from('businesses')
    .select('google_calendar_token')
    .eq('id', businessId)
    .single() as any);

  if (error || !business || !business.google_calendar_token) {
    console.error('[CALENDAR] No OAuth token for business:', businessId);
    return null;
  }

  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const storedToken = JSON.parse(business.google_calendar_token);
  oauth2Client.setCredentials(storedToken);

  // Persist auto-refreshed access tokens so serverless cold-starts always have
  // a valid stored credential. Without this the new access_token is only kept
  // in-memory and lost between requests; the stored token grows stale.
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      const merged = { ...storedToken, ...newTokens };
      const supabase2 = getSupabaseClient();
      await (supabase2.from('businesses') as any)
        .update({ google_calendar_token: JSON.stringify(merged) })
        .eq('id', businessId);
      console.log('[CALENDAR] 🔄 Refreshed OAuth tokens persisted for business:', businessId);
    } catch (err) {
      console.warn('[CALENDAR] Failed to persist refreshed tokens (non-fatal):', err);
    }
  });

  return oauth2Client;
}

/**
 * Get available time slots for a given date
 */
/**
 * Get available time slots for a given date
 * Level 4 Caching: Cache availability for 24 hours to reduce API costs
 */
export async function getAvailableSlots(
  businessId: string,
  date: string, // Format: YYYY-MM-DD
  businessHours: { start: string; end: string } = { start: '08:00', end: '18:00' },
  options: {
    durationMinutes?: number;   // service duration — used to check if full block is free
    bufferMinutes?: number;     // gap to enforce after each appointment
    minAdvanceHours?: number;   // minimum hours from now before a slot can be offered
  } = {}
): Promise<string[]> {
  const { durationMinutes = 60, bufferMinutes = 0, minAdvanceHours = 0 } = options;
  const effectiveBlock = durationMinutes + bufferMinutes; // total calendar time needed

  // Fetch business timezone (falls back to Asia/Colombo if not set)
  const config = await getBusinessCalendarConfig(businessId);
  const tz = config?.timezone ?? 'Asia/Colombo';
  // Build the UTC offset string for this timezone at the given date
  const tzOffset = getTzOffset(tz, date);

  // Cache key includes options so different service configs don't share stale results
  const cacheKey = `calendar:availability:${businessId}:${date}:${durationMinutes}:${bufferMinutes}`;

  try {
    // 1. Check Cache (skip if minAdvanceHours > 0 — "today" slots depend on current time)
    if (minAdvanceHours === 0) {
      const cached = await redis.get<string[]>(cacheKey);
      if (cached) {
        console.log('[CALENDAR] ⚡️ Cache hit for', date);
        return cached;
      }
    }
  } catch (err) {
    console.warn('[CALENDAR] Cache check failed:', err);
  }

  const auth = await getOAuth2Client(businessId);
  if (!auth) return [];

  try {
    // Get start and end of day using the business's local timezone offset
    const dayStart = new Date(`${date}T${businessHours.start}:00${tzOffset}`);
    const dayEnd   = new Date(`${date}T${businessHours.end}:00${tzOffset}`);

    console.log('[CALENDAR] 🔄 API Call: Checking availability for', date);

    // Check busy times via freebusy API
    const response = await calendar.freebusy.query({
      auth,
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busySlots = response.data.calendars?.primary?.busy || [];

    // Generate all possible 1-hour slots (keep hourly grid for consistency)
    const allSlots: string[] = [];
    let currentTime = new Date(dayStart);
    // Last possible start: dayEnd minus the effective block
    const lastPossibleStart = new Date(dayEnd.getTime() - effectiveBlock * 60 * 1000);

    while (currentTime <= lastPossibleStart) {
      allSlots.push(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(currentTime)
      ); // HH:MM in business timezone
      currentTime = new Date(currentTime.getTime() + 60 * 60 * 1000); // +1 hour
    }

    // Minimum advance time: earliest bookable moment
    const earliestBookable = minAdvanceHours > 0
      ? new Date(Date.now() + minAdvanceHours * 3_600_000)
      : null;

    // Filter out busy and too-soon slots
    const availableSlots = allSlots.filter((slot) => {
      const slotStart = new Date(`${date}T${slot}:00${tzOffset}`);
      // A slot needs `effectiveBlock` minutes of free time
      const slotEnd = new Date(slotStart.getTime() + effectiveBlock * 60 * 1000);

      // Minimum advance booking check
      if (earliestBookable && slotStart < earliestBookable) return false;

      // Overlap check against busy periods
      const isOverlapping = busySlots.some((busy) => {
        const busyStart = new Date(busy.start!);
        const busyEnd   = new Date(busy.end!);
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      return !isOverlapping;
    });

    console.log('[CALENDAR] ✅ Found', availableSlots.length, 'available slots');

    // 2. Set Cache (TTL 24 hours — skip for same-day advance-booking queries)
    try {
      if (availableSlots.length > 0 && minAdvanceHours === 0) {
        await redis.set(cacheKey, availableSlots, { ex: 86400 });
      }
    } catch (err) {
      console.warn('[CALENDAR] Cache set failed:', err);
    }

    return availableSlots;
  } catch (error) {
    console.error('[CALENDAR] Error fetching slots:', error);
    return [];
  }
}

/**
 * Reschedule an existing appointment: update DB row + patch the Google Calendar event.
 */
export async function rescheduleAppointment(
  businessId: string,
  appointmentId: string,
  details: {
    newDate: string;  // YYYY-MM-DD
    newTime: string;  // HH:MM
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  // Fetch the existing appointment to get duration + google_event_id
  const { data: appt, error: fetchErr } = await (supabase
    .from('appointments') as any)
    .select('google_event_id, duration_minutes, service_type, customer_name, customer_phone, appointment_date')
    .eq('id', appointmentId)
    .eq('business_id', businessId)
    .single();

  if (fetchErr || !appt) return { success: false, error: 'Appointment not found' };

  const [auth, config] = await Promise.all([
    getOAuth2Client(businessId),
    getBusinessCalendarConfig(businessId),
  ]);
  if (!auth) return { success: false, error: 'Calendar not connected' };

  const tz = config?.timezone ?? 'Asia/Colombo';
  const tzOffset = getTzOffset(tz, details.newDate);
  const startDT = new Date(`${details.newDate}T${details.newTime}:00${tzOffset}`);
  const endDT   = new Date(startDT.getTime() + (appt.duration_minutes ?? 60) * 60 * 1000);

  try {
    if (appt.google_event_id) {
      await calendar.events.patch({
        auth,
        calendarId: 'primary',
        eventId: appt.google_event_id,
        requestBody: {
          summary: `${appt.service_type} - ${appt.customer_name}`,
          start: { dateTime: startDT.toISOString(), timeZone: tz },
          end:   { dateTime: endDT.toISOString(),   timeZone: tz },
        },
      });
    }

    // Update DB
    await (supabase.from('appointments') as any)
      .update({
        appointment_date: details.newDate,
        appointment_time: details.newTime,
        reminders_sent: {},
        review_requested_at: null,
      })
      .eq('id', appointmentId)
      .eq('business_id', businessId);

    // Invalidate all availability cache variants (service-specific suffixes included) for both dates
    const oldApptDate = appt.appointment_date;
    await Promise.all([
      invalidateAvailabilityCache(businessId, details.newDate),
      oldApptDate ? invalidateAvailabilityCache(businessId, oldApptDate) : Promise.resolve(),
    ]);

    console.log('[CALENDAR] ✅ Appointment rescheduled:', appointmentId);
    return { success: true };
  } catch (err: any) {
    console.error('[CALENDAR] Reschedule error:', err);
    return { success: false, error: err.message || 'Reschedule failed' };
  }
}

/**
 * Create a calendar event (book appointment)
 */
export async function createAppointment(
  businessId: string,
  details: {
    date: string;
    time: string;
    duration: number;
    customerName: string;
    customerPhone: string;
    serviceType: string;
    notes?: string;
  }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const [auth, config] = await Promise.all([
    getOAuth2Client(businessId),
    getBusinessCalendarConfig(businessId),
  ]);
  if (!auth) {
    return { success: false, error: 'Calendar not connected' };
  }

  const tz = config?.timezone ?? 'Asia/Colombo';
  const tzOffset = getTzOffset(tz, details.date);

  try {
    // Use business timezone offset so the event is created at the correct local time
    const startDateTime = new Date(`${details.date}T${details.time}:00${tzOffset}`);
    const endDateTime = new Date(startDateTime.getTime() + details.duration * 60 * 1000);

    console.log('[CALENDAR] Creating appointment:', details);

    const event = await calendar.events.insert({
      auth,
      calendarId: 'primary',
      requestBody: {
        summary: `${details.serviceType} - ${details.customerName}`,
        description: `Customer: ${details.customerName}\nPhone: ${details.customerPhone}\nService: ${details.serviceType}${details.notes ? `\nNotes: ${details.notes}` : ''}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: tz,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: tz,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      },
    });

    console.log('[CALENDAR] ✅ Appointment created:', event.data.id);

    // Invalidate all availability cache variants (service-specific suffixes included) for this date
    await invalidateAvailabilityCache(businessId, details.date);

    return {
      success: true,
      eventId: event.data.id!,
    };
  } catch (error: any) {
    console.error('[CALENDAR] Error creating appointment:', error);
    return {
      success: false,
      error: error.message || 'Failed to create appointment',
    };
  }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(
  businessId: string,
  eventId: string
): Promise<boolean> {
  const auth = await getOAuth2Client(businessId);
  if (!auth) return false;

  try {
    await calendar.events.delete({
      auth,
      calendarId: 'primary',
      eventId,
    });

    console.log('[CALENDAR] ✅ Appointment cancelled:', eventId);
    return true;
  } catch (error) {
    console.error('[CALENDAR] Error cancelling:', error);
    return false;
  }
}