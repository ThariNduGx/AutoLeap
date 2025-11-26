// src/lib/core/tools/calendar-tools.ts

/**
 * Tool definitions for Google Calendar operations
 * These are passed to the LLM for function calling
 */

export const calendarToolsForGemini = [
  {
    functionDeclarations: [
      {
        name: 'get_available_slots',
        description: 'Get available time slots for booking an appointment on a specific date. Returns list of available times in HH:MM format (24-hour).',
        parameters: {
          type: 'object' as const,  // ← Use 'as const' to satisfy TypeScript
          properties: {
            date: {
              type: 'string' as const,
              description: 'Date in YYYY-MM-DD format (e.g., 2025-11-25)',
            },
          },
          required: ['date'],
        },
      },
      {
        name: 'book_appointment',
        description: 'Book an appointment at a specific date and time. Call this AFTER confirming availability with get_available_slots.',
        parameters: {
          type: 'object' as const,
          properties: {
            date: {
              type: 'string' as const,
              description: 'Date in YYYY-MM-DD format (e.g., 2025-11-25)',
            },
            time: {
              type: 'string' as const,
              description: 'Time in HH:MM format, 24-hour (e.g., 14:00 for 2 PM)',
            },
            customer_name: {
              type: 'string' as const,
              description: 'Customer full name',
            },
            customer_phone: {
              type: 'string' as const,
              description: 'Customer phone number (Sri Lankan format: 0771234567)',
            },
            service_type: {
              type: 'string' as const,
              description: 'Type of service (e.g., AC Cleaning, Plumbing, General Cleaning)',
            },
            duration: {
              type: 'number' as const,
              description: 'Duration in minutes (default: 60)',
            },
          },
          required: ['date', 'time', 'customer_name', 'customer_phone', 'service_type'],
        },
      },
    ],
  },
];

/**
 * Tool execution handler
 */
import { getAvailableSlots, createAppointment } from '../../infrastructure/calendar';
import { lockSlot, unlockSlot, isSlotLocked } from '../../infrastructure/redis';
import { getSupabaseClient } from '../../infrastructure/supabase';

export async function executeCalendarTool(
  toolName: string,
  args: any,
  businessId: string
): Promise<any> {
  console.log('[TOOL]', toolName, 'called with:', args);

  switch (toolName) {
    case 'get_available_slots': {
      const { date } = args;

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { error: 'Invalid date format. Use YYYY-MM-DD' };
      }

      const slots = await getAvailableSlots(businessId, date);

      // Filter out locked slots
      const availableSlots = [];
      for (const slot of slots) {
        const locked = await isSlotLocked(businessId, date, slot);
        if (!locked) {
          availableSlots.push(slot);
        }
      }

      return {
        date,
        available_slots: availableSlots,
        count: availableSlots.length,
      };
    }

    case 'book_appointment': {
      const { date, time, customer_name, customer_phone, service_type, duration = 60 } = args;

      // Validate phone number (Sri Lankan format)
      const phoneRegex = /^0\d{9}$/;
      if (!phoneRegex.test(customer_phone)) {
        return { error: 'Invalid phone number. Please provide a valid Sri Lankan number (e.g., 0771234567)' };
      }

      // Check if slot is locked
      const locked = await isSlotLocked(businessId, date, time);
      if (locked) {
        return { error: 'This slot was just booked by another customer. Please choose a different time.' };
      }

      // Lock the slot
      const lockAcquired = await lockSlot(businessId, date, time, 300); // 5 min lock
      if (!lockAcquired) {
        return { error: 'This slot is currently being booked. Please try again in a moment.' };
      }

      try {
        // Create calendar event
        const result = await createAppointment(businessId, {
          date,
          time,
          duration,
          customerName: customer_name,
          customerPhone: customer_phone,
          serviceType: service_type,
        });

        if (!result.success) {
          await unlockSlot(businessId, date, time);
          return { error: result.error };
        }

        // Store in database
        const supabase = getSupabaseClient();
        await (supabase.from('appointments') as any).insert({
          business_id: businessId,
          customer_name,
          customer_phone,
          service_type,
          appointment_date: date,
          appointment_time: time,
          duration_minutes: duration,
          google_event_id: result.eventId,
          status: 'confirmed',
        });

        console.log('[TOOL] ✅ Appointment booked successfully');

        return {
          success: true,
          event_id: result.eventId,
          confirmation: `Appointment confirmed for ${customer_name} on ${date} at ${time}`,
        };
      } catch (error) {
        await unlockSlot(businessId, date, time);
        console.error('[TOOL] Booking error:', error);
        return { error: 'Failed to create appointment. Please try again.' };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}