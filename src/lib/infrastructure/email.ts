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

export interface CancellationEmailData {
    toEmail: string;
    businessName: string;
    customerChatId: string;
    serviceType: string;
    appointmentDate: string;
    appointmentTime: string;
}

export interface BudgetAlertEmailData {
    toEmail: string;
    businessName: string;
    usagePercent: number;
    currentUsageUsd: number;
    monthlyBudgetUsd: number;
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
 * Send a booking cancellation alert email to the business owner.
 */
export async function sendCancellationAlertEmail(data: CancellationEmailData): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[EMAIL] RESEND_API_KEY not set — skipping cancellation email');
        return;
    }

    try {
        await resend.emails.send({
            from: FROM_ADDRESS,
            to: data.toEmail,
            subject: `Booking Cancelled: ${data.serviceType} — ${data.appointmentDate}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #dc2626; margin-bottom: 4px;">Appointment Cancelled</h2>
                    <p style="color: #6b7280; margin-top: 0;">via <strong>${data.businessName}</strong></p>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
                        <tr>
                            <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Customer ID</td>
                            <td style="padding: 10px 0; font-weight: 600; font-family: monospace; border-bottom: 1px solid #f3f4f6;">${data.customerChatId}</td>
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

                    <div style="margin-top: 32px; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <p style="margin: 0; color: #991b1b; font-size: 14px;">
                            This appointment has been cancelled by the customer and removed from your Google Calendar.
                        </p>
                    </div>

                    <p style="margin-top: 32px; color: #9ca3af; font-size: 12px;">
                        AutoLeap · Powered by AI customer service automation
                    </p>
                </div>
            `,
        });

        console.log('[EMAIL] ✅ Cancellation alert sent to', data.toEmail);
    } catch (err) {
        console.error('[EMAIL] Failed to send cancellation email:', err);
    }
}

/**
 * Send a budget usage warning email to the business owner.
 */
export async function sendBudgetAlertEmail(data: BudgetAlertEmailData): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[EMAIL] RESEND_API_KEY not set — skipping budget alert email');
        return;
    }

    try {
        const pct = Math.round(data.usagePercent);
        const isNearLimit = data.usagePercent >= 95;

        await resend.emails.send({
            from: FROM_ADDRESS,
            to: data.toEmail,
            subject: `${isNearLimit ? '🚨' : '⚠️'} AI Budget ${pct}% Used — ${data.businessName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: ${isNearLimit ? '#dc2626' : '#d97706'}; margin-bottom: 4px;">
                        ${isNearLimit ? '🚨 Budget Nearly Exhausted' : '⚠️ Budget Warning'}
                    </h2>
                    <p style="color: #6b7280; margin-top: 0;">via <strong>${data.businessName}</strong></p>

                    <div style="margin-top: 24px; padding: 20px; background: #f9fafb; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                            <span style="color: #6b7280; font-size: 14px;">Monthly Budget</span>
                            <span style="font-weight: 600;">$${data.monthlyBudgetUsd.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                            <span style="color: #6b7280; font-size: 14px;">Used This Month</span>
                            <span style="font-weight: 600; color: ${isNearLimit ? '#dc2626' : '#d97706'};">
                                $${data.currentUsageUsd.toFixed(2)} (${pct}%)
                            </span>
                        </div>
                        <div style="background: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
                            <div style="background: ${isNearLimit ? '#dc2626' : '#d97706'}; height: 100%; width: ${Math.min(pct, 100)}%;"></div>
                        </div>
                    </div>

                    <div style="margin-top: 16px; padding: 16px; background: ${isNearLimit ? '#fef2f2' : '#fffbeb'}; border-radius: 8px; border-left: 4px solid ${isNearLimit ? '#ef4444' : '#f59e0b'};">
                        <p style="margin: 0; color: ${isNearLimit ? '#991b1b' : '#92400e'}; font-size: 14px;">
                            ${isNearLimit
                                ? 'Your AI assistant will stop responding to customers when the limit is reached. Please increase your budget to ensure uninterrupted service.'
                                : 'Your AI assistant will continue working normally. Log in to your dashboard to review usage or increase your monthly budget.'
                            }
                        </p>
                    </div>

                    <p style="margin-top: 32px; color: #9ca3af; font-size: 12px;">
                        AutoLeap · Powered by AI customer service automation
                    </p>
                </div>
            `,
        });

        console.log(`[EMAIL] ✅ Budget alert (${pct}%) sent to`, data.toEmail);
    } catch (err) {
        console.error('[EMAIL] Failed to send budget alert email:', err);
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

export interface WeeklySummaryEmailData {
    toEmail: string;
    businessName: string;
    weekStart: string; // e.g. "Mar 17, 2026"
    weekEnd: string;   // e.g. "Mar 23, 2026"
    newBookings: number;
    cancellations: number;
    conversations: number;
    topFAQs: { question: string; hits: number }[];
    aiCostUsd: number;
}

/**
 * Send a weekly activity digest to the business owner every Monday.
 */
export async function sendWeeklySummaryEmail(data: WeeklySummaryEmailData): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[EMAIL] RESEND_API_KEY not set — skipping weekly summary');
        return;
    }

    const faqRows = data.topFAQs.length > 0
        ? data.topFAQs.slice(0, 5).map((f, i) => `
            <tr>
                <td style="padding:8px 0;color:#6b7280;font-size:13px;">${i + 1}.</td>
                <td style="padding:8px 0;font-size:13px;">${f.question}</td>
                <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:600;color:#4f46e5;">${f.hits}</td>
            </tr>`).join('')
        : '<tr><td colspan="3" style="padding:8px 0;color:#9ca3af;font-size:13px;">No FAQ queries this week</td></tr>';

    try {
        await resend.emails.send({
            from: FROM_ADDRESS,
            to: data.toEmail,
            subject: `📊 Weekly Summary — ${data.businessName} (${data.weekStart}–${data.weekEnd})`,
            html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fafafa;">
                    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
                        <h2 style="margin:0 0 4px 0;color:#111827;">📊 Weekly Summary</h2>
                        <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;">
                            ${data.businessName} &mdash; ${data.weekStart} to ${data.weekEnd}
                        </p>

                        <!-- KPI Grid -->
                        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                            <tr>
                                <td style="width:25%;text-align:center;padding:16px;background:#f0fdf4;border-radius:8px;">
                                    <div style="font-size:28px;font-weight:700;color:#16a34a;">${data.newBookings}</div>
                                    <div style="font-size:12px;color:#6b7280;margin-top:4px;">New Bookings</div>
                                </td>
                                <td style="width:4%;"></td>
                                <td style="width:25%;text-align:center;padding:16px;background:#fef2f2;border-radius:8px;">
                                    <div style="font-size:28px;font-weight:700;color:#dc2626;">${data.cancellations}</div>
                                    <div style="font-size:12px;color:#6b7280;margin-top:4px;">Cancellations</div>
                                </td>
                                <td style="width:4%;"></td>
                                <td style="width:25%;text-align:center;padding:16px;background:#eff6ff;border-radius:8px;">
                                    <div style="font-size:28px;font-weight:700;color:#2563eb;">${data.conversations}</div>
                                    <div style="font-size:12px;color:#6b7280;margin-top:4px;">Conversations</div>
                                </td>
                                <td style="width:4%;"></td>
                                <td style="width:25%;text-align:center;padding:16px;background:#faf5ff;border-radius:8px;">
                                    <div style="font-size:28px;font-weight:700;color:#7c3aed;">$${data.aiCostUsd.toFixed(2)}</div>
                                    <div style="font-size:12px;color:#6b7280;margin-top:4px;">AI Cost</div>
                                </td>
                            </tr>
                        </table>

                        <!-- Top FAQs -->
                        <h3 style="margin:0 0 12px 0;color:#111827;font-size:15px;">Top FAQ Queries</h3>
                        <table style="width:100%;border-collapse:collapse;">
                            <thead>
                                <tr>
                                    <th style="text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;width:24px;">#</th>
                                    <th style="text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;">Question</th>
                                    <th style="text-align:right;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding-bottom:8px;">Hits</th>
                                </tr>
                            </thead>
                            <tbody>${faqRows}</tbody>
                        </table>

                        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f3f4f6;text-align:center;">
                            <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://autoleap.app'}/dashboard"
                               style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
                                Open Dashboard →
                            </a>
                        </div>

                        <p style="margin-top:24px;color:#9ca3af;font-size:12px;text-align:center;">
                            AutoLeap · Weekly digest · <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/dashboard/settings" style="color:#9ca3af;">Manage settings</a>
                        </p>
                    </div>
                </div>
            `,
        });

        console.log('[EMAIL] ✅ Weekly summary sent to', data.toEmail);
    } catch (err) {
        console.error('[EMAIL] Failed to send weekly summary:', err);
    }
}
