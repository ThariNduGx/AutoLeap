// src/lib/core/tools/calendar-tools.ts

/**
 * Tool definitions for Google Calendar operations.
 * These are passed to the LLM for function calling.
 */

export const calendarToolsForGemini = [
  {
    functionDeclarations: [
      {
        name: 'get_available_slots',
        description:
          'Get available time slots for booking an appointment on a specific date. ' +
          'Returns list of available times in HH:MM format (24-hour). ' +
          'Pass service_name so the system can enforce buffer time and minimum-advance rules.',
        parameters: {
          type: 'object' as const,
          properties: {
            date: {
              type: 'string' as const,
              description: 'Date in YYYY-MM-DD format (e.g., 2025-11-25)',
            },
            service_name: {
              type: 'string' as const,
              description: 'Exact service or tier name the customer wants to book (e.g. "Hydra Cleanup")',
            },
          },
          required: ['date'],
        },
      },
      {
        name: 'book_appointment',
        description:
          'Book an appointment. Call AFTER confirming availability with get_available_slots.',
        parameters: {
          type: 'object' as const,
          properties: {
            date: { type: 'string' as const, description: 'Date in YYYY-MM-DD format' },
            time: { type: 'string' as const, description: 'Time in HH:MM 24-hour format' },
            customer_name:  { type: 'string' as const, description: 'Customer full name' },
            customer_phone: { type: 'string' as const, description: 'Customer phone number' },
            service_type:   { type: 'string' as const, description: 'Exact service or tier name' },
            duration:       { type: 'number' as const, description: 'Duration in minutes (default: 60)' },
            notes:          { type: 'string' as const, description: 'Special requests or notes from the customer (optional)' },
            price:          { type: 'number' as const, description: 'Price of the selected tier/service (optional)' },
            currency:       { type: 'string' as const, description: 'Currency code, e.g. LKR (optional)' },
          },
          required: ['date', 'time', 'customer_name', 'customer_phone', 'service_type'],
        },
      },
      {
        name: 'reschedule_appointment',
        description:
          'Reschedule the customer\'s existing upcoming appointment to a new date and time. ' +
          'Call get_available_slots first to confirm the new slot is free, then call this tool.',
        parameters: {
          type: 'object' as const,
          properties: {
            new_date: { type: 'string' as const, description: 'New date in YYYY-MM-DD format' },
            new_time: { type: 'string' as const, description: 'New time in HH:MM 24-hour format' },
          },
          required: ['new_date', 'new_time'],
        },
      },
    ],
  },
];

/**
 * Tool execution handler
 */
import { getAvailableSlots, createAppointment, rescheduleAppointment } from '../../infrastructure/calendar';
import { lockSlot, unlockSlot, isSlotLocked } from '../../infrastructure/redis';
import { getSupabaseClient } from '../../infrastructure/supabase';

/** Lookup active service by name (or tier name) for a business */
async function lookupService(
  businessId: string,
  serviceName: string
): Promise<{ duration_minutes: number; buffer_minutes: number; min_advance_hours: number; price: number | null; currency: string } | null> {
  if (!serviceName) return null;
  const supabase = getSupabaseClient();
  const { data: services } = await (supabase
    .from('services') as any)
    .select('name, duration_minutes, buffer_minutes, min_advance_hours, price, currency, tiers')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (!services?.length) return null;

  const lower = serviceName.toLowerCase();

  for (const svc of services) {
    // Check tiers first (tier name takes priority)
    if (Array.isArray(svc.tiers)) {
      const tier = svc.tiers.find((t: any) => t.name?.toLowerCase() === lower);
      if (tier) {
        return {
          duration_minutes: tier.duration_minutes ?? svc.duration_minutes,
          buffer_minutes:   svc.buffer_minutes,
          min_advance_hours: svc.min_advance_hours,
          price:    tier.price ?? null,
          currency: svc.currency ?? 'LKR',
        };
      }
    }
    // Fallback to service name
    if (svc.name.toLowerCase() === lower) {
      return {
        duration_minutes:  svc.duration_minutes,
        buffer_minutes:    svc.buffer_minutes,
        min_advance_hours: svc.min_advance_hours,
        price:    svc.price ?? null,
        currency: svc.currency ?? 'LKR',
      };
    }
  }
  return null;
}

export async function executeCalendarTool(
  toolName: string,
  args: any,
  businessId: string
): Promise<any> {
  console.log('[TOOL]', toolName, 'called with:', args);

  switch (toolName) {
    // ── get_available_slots ──────────────────────────────────────────────────
    case 'get_available_slots': {
      const { date, service_name } = args;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00Z').getTime())) {
        return { error: 'Invalid date. Use YYYY-MM-DD format with a real calendar date.' };
      }

      // Reject past dates using Asia/Colombo as the reference timezone (en-CA gives YYYY-MM-DD)
      const todayLK = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
      if (date < todayLK) {
        return { error: 'Cannot check availability for past dates.' };
      }

      // Look up service config for duration, buffer, and min_advance_hours
      const svcConfig = service_name ? await lookupService(businessId, service_name) : null;

      // ── Blackout check ───────────────────────────────────────────────────
      const supabase = getSupabaseClient();
      const dateObj = new Date(date + 'T00:00:00Z');
      const mmdd = `${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')}`;

      const { data: blackout } = await (supabase
        .from('business_blackouts') as any)
        .select('label')
        .eq('business_id', businessId)
        .or(`date.eq.${date},and(repeat_annually.eq.true,date.like.%-${mmdd})`)
        .limit(1)
        .maybeSingle();

      if (blackout) {
        return {
          date,
          available_slots: [],
          count: 0,
          closed: true,
          reason: blackout.label ?? 'Closed',
        };
      }

      // ── Business hours check ─────────────────────────────────────────────
      const { data: bizHours } = await (supabase
        .from('businesses') as any)
        .select('business_hours')
        .eq('id', businessId)
        .single();

      const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = DAYS_OF_WEEK[dateObj.getUTCDay()];
      const dayConfig = bizHours?.business_hours?.[dayName];

      if (dayConfig && dayConfig.enabled === false) {
        return {
          date,
          available_slots: [],
          count: 0,
          closed: true,
          reason: 'Closed',
        };
      }

      const businessHours = dayConfig?.enabled
        ? { start: dayConfig.open, end: dayConfig.close }
        : undefined;

      const slots = await getAvailableSlots(businessId, date, businessHours, {
        durationMinutes:   svcConfig?.duration_minutes,
        bufferMinutes:     svcConfig?.buffer_minutes,
        minAdvanceHours:   svcConfig?.min_advance_hours,
      });

      // Filter out Redis-locked slots
      const availableSlots: string[] = [];
      for (const slot of slots) {
        if (!(await isSlotLocked(businessId, date, slot))) {
          availableSlots.push(slot);
        }
      }

      return { date, available_slots: availableSlots, count: availableSlots.length };
    }

    // ── book_appointment ─────────────────────────────────────────────────────
    case 'book_appointment': {
      const {
        date, time,
        customer_name, customer_phone,
        service_type,
        duration = 60,
        notes,
        customer_chat_id,
        price: argPrice,
        currency: argCurrency,
      } = args;

      // Reject past dates using Asia/Colombo as the reference timezone
      const todayLKBook = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
      if (date < todayLKBook) {
        return { error: 'Cannot book an appointment in the past. Please choose a future date.' };
      }

      // Validate requested time is within business hours for that day.
      // This mirrors the check in get_available_slots and closes the gap where a
      // customer could bypass the slot-picker UI (e.g. via a crafted slot: callback
      // or by instructing the LLM directly) to book at a time outside opening hours.
      {
        const supabase = getSupabaseClient();
        const { data: bizHoursRow } = await (supabase
          .from('businesses') as any)
          .select('business_hours')
          .eq('id', businessId)
          .single();

        const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dateObjBook = new Date(date + 'T00:00:00Z');
        const dayName = DAYS_OF_WEEK[dateObjBook.getUTCDay()];
        const dayConfig = bizHoursRow?.business_hours?.[dayName];

        if (dayConfig?.enabled === false) {
          return { error: `The business is closed on ${dayName}s. Please choose a different date.` };
        }
        if (dayConfig?.open && dayConfig?.close) {
          if (time < dayConfig.open || time >= dayConfig.close) {
            return {
              error: `${time} is outside business hours (${dayConfig.open}–${dayConfig.close}). ` +
                     `Please choose a time within business hours.`,
            };
          }
        }
      }

      // Validate phone
      const cleaned = customer_phone.replace(/[\s\-\(\)\.]/g, '');
      if (!/^\+?\d{7,15}$/.test(cleaned)) {
        return { error: 'Invalid phone number. Please provide a valid phone number (e.g., 0771234567 or +94771234567).' };
      }

      // Validate service_type exists in the DB (prevents hallucinated service names)
      const svcInfo = service_type ? await lookupService(businessId, service_type) : null;
      if (service_type && !svcInfo) {
        return { error: `Service "${service_type}" is not available. Please check available services and try again.` };
      }

      // Always resolve price from the DB — never trust the LLM-supplied value.
      // argPrice is intentionally ignored: a customer could prompt-inject a price
      // of 0 or a fabricated discount, and the LLM would pass it here unchecked.
      const finalPrice: number | null = svcInfo?.price ?? null;
      const finalCurrency: string     = svcInfo?.currency ?? argCurrency ?? 'LKR';

      // Atomically lock the slot for 120 seconds to prevent double-booking
      const lockAcquired = await lockSlot(businessId, date, time, 120);
      if (!lockAcquired) {
        return { error: 'This slot was just booked by another customer. Please choose a different time.' };
      }

      try {
        const result = await createAppointment(businessId, {
          date, time, duration,
          customerName:  customer_name,
          customerPhone: customer_phone,
          serviceType:   service_type,
          notes,
        });

        if (!result.success) {
          await unlockSlot(businessId, date, time);
          return { error: result.error };
        }

        const supabase = getSupabaseClient();
        await (supabase.from('appointments') as any).insert({
          business_id:       businessId,
          customer_name,
          customer_phone,
          service_type,
          appointment_date:  date,
          appointment_time:  time,
          duration_minutes:  duration,
          google_event_id:   result.eventId,
          status:            'scheduled',
          customer_chat_id:  customer_chat_id || null,
          platform:          args._platform || null,
          notes:             notes || null,
          price:             finalPrice,
          currency:          finalCurrency,
        });

        // Upsert customer profile and increment total_bookings
        try {
          await (supabase.from('customers') as any)
            .upsert({
              business_id: businessId,
              phone:       customer_phone,
              name:        customer_name,
              platform:    args._platform || null,
              chat_id:     customer_chat_id || null,
              updated_at:  new Date().toISOString(),
            }, { onConflict: 'business_id,phone', ignoreDuplicates: false });

          // Increment total_bookings counter (same pattern as noshow_count in bookings API)
          const { data: cust } = await (supabase.from('customers') as any)
            .select('id, total_bookings')
            .eq('business_id', businessId)
            .eq('phone', customer_phone)
            .maybeSingle();
          if (cust) {
            await (supabase.from('customers') as any)
              .update({ total_bookings: (cust.total_bookings ?? 0) + 1 })
              .eq('id', cust.id);
          }
        } catch (custErr) {
          console.warn('[TOOL] Customer profile upsert failed (non-fatal):', custErr);
        }

        console.log('[TOOL] ✅ Appointment booked successfully');
        return {
          success:      true,
          event_id:     result.eventId,
          confirmation: `Appointment confirmed for ${customer_name} on ${date} at ${time}`,
          price:        finalPrice,
          currency:     finalCurrency,
        };
      } catch (error) {
        await unlockSlot(businessId, date, time);
        console.error('[TOOL] Booking error:', error);
        return { error: 'Failed to create appointment. Please try again.' };
      }
    }

    // ── reschedule_appointment ───────────────────────────────────────────────
    case 'reschedule_appointment': {
      const { new_date, new_time, appointment_id } = args;

      if (!appointment_id) {
        return { error: 'No appointment ID provided for rescheduling.' };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(new_date)) {
        return { error: 'Invalid date format. Use YYYY-MM-DD' };
      }

      // Reject past dates using Asia/Colombo as the reference timezone
      const todayLKReschedule = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
      if (new_date < todayLKReschedule) {
        return { error: 'Cannot reschedule to a date in the past. Please choose a future date.' };
      }

      // Lock the new slot for 120 seconds to prevent double-booking
      const lockAcquired = await lockSlot(businessId, new_date, new_time, 120);
      if (!lockAcquired) {
        return { error: 'That slot is no longer available. Please choose a different time.' };
      }

      try {
        const result = await rescheduleAppointment(businessId, appointment_id, {
          newDate: new_date,
          newTime: new_time,
        });

        if (!result.success) {
          await unlockSlot(businessId, new_date, new_time);
          return { error: result.error };
        }

        return {
          success:      true,
          confirmation: `Your appointment has been rescheduled to ${new_date} at ${new_time}`,
        };
      } catch (err) {
        await unlockSlot(businessId, new_date, new_time);
        return { error: 'Failed to reschedule. Please try again.' };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
