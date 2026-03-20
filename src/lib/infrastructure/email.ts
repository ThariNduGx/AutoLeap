import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/** The from address must be a verified domain in your Resend account. */
const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'AutoLeap <notifications@autoleap.app>';

export interface BookingEmailData {
    toEmail: string;
    businessName: string;
    customerName: string;
    customerPhone: string;
    serviceType: string;
    appointmentDate: string; // YYYY-MM-DD
    appointmentTime: string; // HH:MM
}

export interface ComplaintEmailData {
    toEmail: string;
    businessName: string;
    customerChatId: string;
    platform: 'telegram' | 'facebook';
    messageText: string;
}

/**
 * Send a new-booking confirmation email to the business owner.
 */
export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[EMAIL] RESEND_API_KEY not set — skipping booking email');
        return;
    }

    try {
        await resend.emails.send({
            from: FROM_ADDRESS,
            to: data.toEmail,
            subject: `New Booking: ${data.serviceType} — ${data.appointmentDate}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #4f46e5; margin-bottom: 4px;">New Appointment Booked</h2>
                    <p style="color: #6b7280; margin-top: 0;">via <strong>${data.businessName}</strong></p>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
                        <tr>
                            <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Customer</td>
                            <td style="padding: 10px 0; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${data.customerName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Phone</td>
                            <td style="padding: 10px 0; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${data.customerPhone}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Service</td>
                            <td style="padding: 10px 0; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${data.serviceType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Date</td>
                            <td style="padding: 10px 0; font-weight: 600; border-bottom: 1px solid #f3f4f6;">${data.appointmentDate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Time</td>
                            <td style="padding: 10px 0; font-weight: 600;">${data.appointmentTime}</td>
                        </tr>
                    </table>

                    <div style="margin-top: 32px; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
                        <p style="margin: 0; color: #166534; font-size: 14px;">
                            This booking was created automatically by your AI assistant.
                            It has been added to your Google Calendar.
                        </p>
                    </div>

                    <p style="margin-top: 32px; color: #9ca3af; font-size: 12px;">
                        AutoLeap · Powered by AI customer service automation
                    </p>
                </div>
            `,
        });

        console.log('[EMAIL] ✅ Booking confirmation sent to', data.toEmail);
    } catch (err) {
        console.error('[EMAIL] Failed to send booking email:', err);
    }
}

/**
 * Send a complaint alert email to the business owner.
 */
export async function sendComplaintAlertEmail(data: ComplaintEmailData): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[EMAIL] RESEND_API_KEY not set — skipping complaint email');
        return;
    }

    try {
        await resend.emails.send({
            from: FROM_ADDRESS,
            to: data.toEmail,
            subject: `⚠️ Customer Complaint Received — ${data.businessName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #dc2626; margin-bottom: 4px;">⚠️ Complaint Alert</h2>
                    <p style="color: #6b7280; margin-top: 0;">via <strong>${data.businessName}</strong> on ${data.platform === 'telegram' ? 'Telegram' : 'Facebook Messenger'}</p>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
                        <tr>
                            <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Customer ID</td>
                            <td style="padding: 10px 0; font-weight: 600; font-family: monospace; border-bottom: 1px solid #f3f4f6;">${data.customerChatId}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Platform</td>
                            <td style="padding: 10px 0; font-weight: 600; border-bottom: 1px solid #f3f4f6; text-transform: capitalize;">${data.platform}</td>
                        </tr>
                    </table>

                    <div style="margin-top: 24px; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Message</p>
                        <p style="margin: 0; color: #7f1d1d; font-size: 14px;">${data.messageText}</p>
                    </div>

                    <div style="margin-top: 16px; padding: 16px; background: #fff7ed; border-radius: 8px;">
                        <p style="margin: 0; color: #9a3412; font-size: 14px;">
                            The AI has paused responses for this conversation.
                            Log in to your AutoLeap dashboard to take over and respond directly.
                        </p>
                    </div>

                    <p style="margin-top: 32px; color: #9ca3af; font-size: 12px;">
                        AutoLeap · Powered by AI customer service automation
                    </p>
                </div>
            `,
        });

        console.log('[EMAIL] ✅ Complaint alert sent to', data.toEmail);
    } catch (err) {
        console.error('[EMAIL] Failed to send complaint email:', err);
    }
}
