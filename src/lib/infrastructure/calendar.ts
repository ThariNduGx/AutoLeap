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

  oauth2Client.setCredentials(JSON.parse(business.google_calendar_token));

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
  businessHours: { start: string; end: string } = { start: '08:00', end: '18:00' }
): Promise<string[]> {
  // Fetch business timezone (falls back to Asia/Colombo if not set)
  const config = await getBusinessCalendarConfig(businessId);
  const tz = config?.timezone ?? 'Asia/Colombo';
  // Build the UTC offset string for this timezone at the given date
  const tzOffset = getTzOffset(tz, date);

  const cacheKey = `calendar:availability:${businessId}:${date}`;

  try {
    // 1. Check Cache
    const cached = await redis.get<string[]>(cacheKey);
    if (cached) {
      console.log('[CALENDAR] ⚡️ Cache hit for', date);
      return cached;
    }
  } catch (err) {
    console.warn('[CALENDAR] Cache check failed:', err);
  }

  const auth = await getOAuth2Client(businessId);
  if (!auth) return [];

  try {
    // Get start and end of day using the business's local timezone offset
    const dayStart = new Date(`${date}T${businessHours.start}:00${tzOffset}`);
    const dayEnd = new Date(`${date}T${businessHours.end}:00${tzOffset}`);

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

    // Generate all possible 1-hour slots
    const allSlots: string[] = [];
    let currentTime = new Date(dayStart);

    while (currentTime < dayEnd) {
      allSlots.push(currentTime.toTimeString().substring(0, 5)); // HH:MM format
      currentTime.setHours(currentTime.getHours() + 1);
    }

    // Filter out busy slots using the business's local timezone offset
    const availableSlots = allSlots.filter((slot) => {
      const slotStart = new Date(`${date}T${slot}:00${tzOffset}`);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // +1 hour

      // Check if slot overlaps with any busy time
      const isOverlapping = busySlots.some((busy) => {
        const busyStart = new Date(busy.start!);
        const busyEnd = new Date(busy.end!);
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      return !isOverlapping;
    });

    console.log('[CALENDAR] ✅ Found', availableSlots.length, 'available slots');

    // 2. Set Cache (TTL 24 hours = 86400 seconds)
    try {
      if (availableSlots.length > 0) {
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
 * Create a calendar event (book appointment)
 */
export async function createAppointment(
  businessId: string,
  details: {
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    duration: number; // minutes
    customerName: string;
    customerPhone: string;
    serviceType: string;
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
        description: `Customer: ${details.customerName}\nPhone: ${details.customerPhone}\nService: ${details.serviceType}`,
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

    // Invalidate cache for this date
    try {
      await redis.del(`calendar:availability:${businessId}:${details.date}`);
      console.log('[CALENDAR] 🧹 Cache invalidated for', details.date);
    } catch (err) {
      console.warn('[CALENDAR] Failed to invalidate cache:', err);
    }

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