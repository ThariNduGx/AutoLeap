'use client';

import { useState, useEffect } from 'react';
import {
    Building2, MessageSquare, Facebook, User, Shield, Save, Loader2,
    CheckCircle2, XCircle, X, Eye, EyeOff, Calendar, Clock, Globe,
    AlertTriangle, DollarSign, TimerOff, Bot, Ban, Bell, Plus, Trash2,
} from 'lucide-react';

// IANA timezone list (subset — most common zones)
const TIMEZONES = [
    'Asia/Colombo',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Bangkok',
    'Asia/Dhaka',
    'Asia/Karachi',
    'Asia/Kathmandu',
    'Asia/Yangon',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Australia/Sydney',
    'Pacific/Auckland',
    'UTC',
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Day = typeof DAYS[number];

interface DayHours {
    open: string;
    close: string;
    enabled: boolean;
}

type BusinessHours = Record<Day, DayHours>;

const DEFAULT_HOURS: BusinessHours = {
    monday:    { open: '08:00', close: '18:00', enabled: true },
    tuesday:   { open: '08:00', close: '18:00', enabled: true },
    wednesday: { open: '08:00', close: '18:00', enabled: true },
    thursday:  { open: '08:00', close: '18:00', enabled: true },
    friday:    { open: '08:00', close: '18:00', enabled: true },
    saturday:  { open: '09:00', close: '14:00', enabled: false },
    sunday:    { open: '09:00', close: '14:00', enabled: false },
};

interface BusinessSettings {
    id: string;
    name: string;
    telegram_bot_token: string | null;
    fb_page_id: string | null;
    fb_page_name: string | null;
    owner_telegram_chat_id: string | null;
    has_google_calendar: boolean;
    google_calendar_email: string | null;
    timezone: string;
    business_hours: BusinessHours | null;
    cancellation_window_hours: number;
}

/** Inline "are you sure?" confirmation button component */
function ConfirmButton({
    label,
    confirmLabel,
    onConfirm,
    disabled,
}: {
    label: string;
    confirmLabel: string;
    onConfirm: () => void;
    disabled?: boolean;
}) {
    const [confirming, setConfirming] = useState(false);

    if (confirming) {
        return (
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Are you sure?</span>
                <button
                    onClick={() => { onConfirm(); setConfirming(false); }}
                    disabled={disabled}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                    {confirmLabel}
                </button>
                <button
                    onClick={() => setConfirming(false)}
                    className="px-3 py-1.5 border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => setConfirming(true)}
            disabled={disabled}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
            {label}
        </button>
    );
}

export default function SettingsPage() {
    const [business, setBusiness] = useState<BusinessSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Business name editing
    const [businessName, setBusinessName] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [nameSaved, setNameSaved] = useState(false);

    // Owner Telegram chat ID
    const [ownerChatId, setOwnerChatId] = useState('');
    const [savingChatId, setSavingChatId] = useState(false);
    const [chatIdSaved, setChatIdSaved] = useState(false);

    // Timezone
    const [timezone, setTimezone] = useState('Asia/Colombo');
    const [savingTimezone, setSavingTimezone] = useState(false);
    const [timezoneSaved, setTimezoneSaved] = useState(false);

    // Business hours
    const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_HOURS);
    const [savingHours, setSavingHours] = useState(false);
    const [hoursSaved, setHoursSaved] = useState(false);

    // Cancellation window
    const [cancelWindow, setCancelWindow] = useState('0');
    const [savingCancelWindow, setSavingCancelWindow] = useState(false);
    const [cancelWindowSaved, setCancelWindowSaved] = useState(false);

    // Budget
    const [monthlyBudget, setMonthlyBudget] = useState('10');
    const [currentUsage, setCurrentUsage] = useState(0);
    const [savingBudget, setSavingBudget] = useState(false);
    const [budgetSaved, setBudgetSaved] = useState(false);

    // Bot persona (C2)
    const [botName, setBotName]       = useState('Assistant');
    const [botGreeting, setBotGreeting] = useState('');
    const [botTone, setBotTone]       = useState('friendly');
    const [savingBot, setSavingBot]   = useState(false);
    const [botSaved, setBotSaved]     = useState(false);

    // Reminder schedule (B6)
    const [reminderHours, setReminderHours]   = useState<number[]>([24, 1]);
    const [reminderInput, setReminderInput]   = useState('');
    const [savingReminders, setSavingReminders] = useState(false);
    const [remindersSaved, setRemindersSaved]   = useState(false);

    // Blackout dates (B1)
    interface Blackout { id: string; date: string; label: string; repeat_annually: boolean; }
    const [blackouts, setBlackouts]     = useState<Blackout[]>([]);
    const [blackoutDate, setBlackoutDate]   = useState('');
    const [blackoutLabel, setBlackoutLabel] = useState('Closed');
    const [blackoutRepeat, setBlackoutRepeat] = useState(false);
    const [savingBlackout, setSavingBlackout] = useState(false);

    // Change password modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNext, setShowNext] = useState(false);

    useEffect(() => {
        fetchBusinessSettings();
    }, []);

    async function fetchBusinessSettings() {
        try {
            const [settingsRes, budgetRes, blackoutsRes] = await Promise.all([
                fetch('/api/business/settings'),
                fetch('/api/settings/budget'),
                fetch('/api/blackouts'),
            ]);
            const data = await settingsRes.json();
            if (data.success) {
                setBusiness(data.business);
                setBusinessName(data.business.name || '');
                setOwnerChatId(data.business.owner_telegram_chat_id || '');
                setTimezone(data.business.timezone || 'Asia/Colombo');
                setBusinessHours(data.business.business_hours || DEFAULT_HOURS);
                setCancelWindow(String(data.business.cancellation_window_hours ?? 0));
                setBotName(data.business.bot_name || 'Assistant');
                setBotGreeting(data.business.bot_greeting || '');
                setBotTone(data.business.bot_tone || 'friendly');
                setReminderHours(Array.isArray(data.business.reminder_hours) ? data.business.reminder_hours : [24, 1]);
            }
            if (budgetRes.ok) {
                const bud = await budgetRes.json();
                setMonthlyBudget(String(bud.monthly_budget_usd ?? 10));
                setCurrentUsage(bud.current_usage_usd ?? 0);
            }
            if (blackoutsRes.ok) {
                setBlackouts(await blackoutsRes.json());
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveBudget() {
        const val = parseFloat(monthlyBudget);
        if (isNaN(val) || val < 0) return;
        setSavingBudget(true);
        setBudgetSaved(false);
        try {
            const res = await fetch('/api/settings/budget', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monthly_budget_usd: val }),
            });
            if (res.ok) {
                setBudgetSaved(true);
                setTimeout(() => setBudgetSaved(false), 3000);
            }
        } finally {
            setSavingBudget(false);
        }
    }

    async function patchSettings(updates: Record<string, unknown>) {
        const res = await fetch('/api/business/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        return res.ok;
    }

    async function handleSaveBusinessName() {
        if (!businessName.trim()) return;
        setSavingName(true);
        setNameSaved(false);
        try {
            if (await patchSettings({ name: businessName.trim() })) {
                setNameSaved(true);
                fetchBusinessSettings();
                setTimeout(() => setNameSaved(false), 3000);
            }
        } finally {
            setSavingName(false);
        }
    }

    async function handleSaveOwnerChatId() {
        setSavingChatId(true);
        setChatIdSaved(false);
        try {
            if (await patchSettings({ owner_telegram_chat_id: ownerChatId })) {
                setChatIdSaved(true);
                setTimeout(() => setChatIdSaved(false), 3000);
            }
        } finally {
            setSavingChatId(false);
        }
    }

    async function handleSaveTimezone() {
        setSavingTimezone(true);
        setTimezoneSaved(false);
        try {
            if (await patchSettings({ timezone })) {
                setTimezoneSaved(true);
                setTimeout(() => setTimezoneSaved(false), 3000);
            }
        } finally {
            setSavingTimezone(false);
        }
    }

    async function handleSaveBusinessHours() {
        setSavingHours(true);
        setHoursSaved(false);
        try {
            if (await patchSettings({ business_hours: businessHours })) {
                setHoursSaved(true);
                setTimeout(() => setHoursSaved(false), 3000);
            }
        } finally {
            setSavingHours(false);
        }
    }

    function updateDayHours(day: Day, field: keyof DayHours, value: string | boolean) {
        setBusinessHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value },
        }));
    }

    async function handleSaveCancelWindow() {
        const hours = parseInt(cancelWindow, 10);
        if (isNaN(hours) || hours < 0 || hours > 168) return;
        setSavingCancelWindow(true);
        setCancelWindowSaved(false);
        try {
            if (await patchSettings({ cancellation_window_hours: hours })) {
                setCancelWindowSaved(true);
                setTimeout(() => setCancelWindowSaved(false), 3000);
            }
        } finally {
            setSavingCancelWindow(false);
        }
    }

    async function handleChangePassword() {
        setPasswordError('');
        if (passwordForm.next !== passwordForm.confirm) {
            setPasswordError('New passwords do not match');
            return;
        }
        if (passwordForm.next.length < 8) {
            setPasswordError('New password must be at least 8 characters');
            return;
        }
        setSavingPassword(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: passwordForm.current, new_password: passwordForm.next }),
            });
            const data = await res.json();
            if (res.ok) {
                setPasswordSuccess(true);
                setPasswordForm({ current: '', next: '', confirm: '' });
                setTimeout(() => {
                    setPasswordSuccess(false);
                    setShowPasswordModal(false);
                }, 2000);
            } else {
                setPasswordError(data.error || 'Failed to change password');
            }
        } finally {
            setSavingPassword(false);
        }
    }

    async function handleDisconnectGoogleCalendar() {
        setSaving(true);
        try {
            if (await patchSettings({ disconnect_google_calendar: true })) {
                fetchBusinessSettings();
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleDisconnectFacebook() {
        setSaving(true);
        try {
            const res = await fetch('/api/business/settings/facebook/disconnect', { method: 'POST' });
            if (res.ok) fetchBusinessSettings();
        } finally {
            setSaving(false);
        }
    }

    async function handleDisconnectTelegram() {
        setSaving(true);
        try {
            const res = await fetch('/api/telegram/disconnect', { method: 'POST' });
            if (res.ok) fetchBusinessSettings();
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-gray-400" size={40} />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-500 mt-1">Manage your business profile and integrations</p>
            </div>

            <div className="space-y-6">
                {/* ── Business Profile ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Building2 size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Business Profile</h2>
                            <p className="text-sm text-gray-500">Your business information</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Business Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={e => setBusinessName(e.target.value)}
                                    maxLength={120}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                    onClick={handleSaveBusinessName}
                                    disabled={savingName || !businessName.trim() || businessName.trim() === business?.name}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {savingName ? <Loader2 size={14} className="animate-spin" /> : nameSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                                    {nameSaved ? 'Saved!' : 'Save'}
                                </button>
                            </div>
                        </div>

                        {/* Business ID */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Business ID</label>
                            <input
                                type="text"
                                value={business?.id || ''}
                                disabled
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-mono text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Timezone & Hours ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <Globe size={20} className="text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Timezone & Business Hours</h2>
                            <p className="text-sm text-gray-500">Controls when customers can book appointments</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Timezone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                            <div className="flex gap-2">
                                <select
                                    value={timezone}
                                    onChange={e => setTimezone(e.target.value)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    {TIMEZONES.map(tz => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleSaveTimezone}
                                    disabled={savingTimezone || timezone === business?.timezone}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {savingTimezone ? <Loader2 size={14} className="animate-spin" /> : timezoneSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                                    {timezoneSaved ? 'Saved!' : 'Save'}
                                </button>
                            </div>
                        </div>

                        {/* Business Hours */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-medium text-gray-700">Business Hours</label>
                                <button
                                    onClick={handleSaveBusinessHours}
                                    disabled={savingHours}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                                >
                                    {savingHours ? <Loader2 size={12} className="animate-spin" /> : hoursSaved ? <CheckCircle2 size={12} /> : <Save size={12} />}
                                    {hoursSaved ? 'Saved!' : 'Save Hours'}
                                </button>
                            </div>
                            <div className="space-y-2">
                                {DAYS.map(day => (
                                    <div key={day} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                                        {/* Toggle */}
                                        <button
                                            onClick={() => updateDayHours(day, 'enabled', !businessHours[day]?.enabled)}
                                            className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${
                                                businessHours[day]?.enabled ? 'bg-indigo-600' : 'bg-gray-300'
                                            }`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                                businessHours[day]?.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                            }`} />
                                        </button>

                                        {/* Day label */}
                                        <span className={`w-24 text-sm font-medium capitalize ${
                                            businessHours[day]?.enabled ? 'text-gray-900' : 'text-gray-400'
                                        }`}>
                                            {day}
                                        </span>

                                        {/* Time inputs */}
                                        {businessHours[day]?.enabled ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    type="time"
                                                    value={businessHours[day]?.open || '08:00'}
                                                    onChange={e => updateDayHours(day, 'open', e.target.value)}
                                                    className="px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <span className="text-gray-400 text-sm">to</span>
                                                <input
                                                    type="time"
                                                    value={businessHours[day]?.close || '18:00'}
                                                    onChange={e => updateDayHours(day, 'close', e.target.value)}
                                                    className="px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400 italic">Closed</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Cancellation Policy ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                            <TimerOff size={20} className="text-rose-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Cancellation Policy</h2>
                            <p className="text-sm text-gray-500">Prevent last-minute self-cancellations via the bot</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minimum notice required to cancel (hours)
                        </label>
                        <p className="text-xs text-gray-400 mb-3">
                            Set to 0 to allow cancellations at any time. If set to e.g. 24, customers cannot cancel within 24 hours of their appointment — the bot will ask them to contact you directly.
                        </p>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                min={0}
                                max={168}
                                step={1}
                                value={cancelWindow}
                                onChange={e => setCancelWindow(e.target.value)}
                                className="w-32 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-500">hours</span>
                            <button
                                onClick={handleSaveCancelWindow}
                                disabled={savingCancelWindow || parseInt(cancelWindow) === business?.cancellation_window_hours}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                            >
                                {savingCancelWindow ? <Loader2 size={14} className="animate-spin" /> : cancelWindowSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                                {cancelWindowSaved ? 'Saved!' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Integrations ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <MessageSquare size={20} className="text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
                            <p className="text-sm text-gray-500">Connect your messaging platforms</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Telegram Integration */}
                        <div className="p-4 border border-gray-200 rounded-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                                        <MessageSquare size={24} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Telegram Bot</h3>
                                        <p className="text-sm text-gray-500">Connect your Telegram bot</p>
                                    </div>
                                </div>
                                {business?.telegram_bot_token ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg">
                                        <CheckCircle2 size={16} />
                                        <span className="text-sm font-medium">Connected</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-500 rounded-lg">
                                        <XCircle size={16} />
                                        <span className="text-sm font-medium">Not Connected</span>
                                    </div>
                                )}
                            </div>

                            {business?.telegram_bot_token ? (
                                <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Bot Connected</p>
                                            <p className="text-xs text-gray-500 mt-1">Your Telegram bot is active and receiving messages</p>
                                        </div>
                                        <ConfirmButton
                                            label="Disconnect"
                                            confirmLabel="Yes, Disconnect"
                                            onConfirm={handleDisconnectTelegram}
                                            disabled={saving}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4">
                                    <TelegramConnectButton businessId={business?.id || ''} onSuccess={fetchBusinessSettings} />
                                </div>
                            )}
                        </div>

                        {/* Owner Telegram notification chat ID */}
                        {business?.telegram_bot_token && (
                            <div className="p-4 border border-indigo-100 bg-indigo-50 rounded-xl">
                                <h4 className="text-sm font-semibold text-gray-900 mb-1">Receive Complaint & Cancellation Alerts</h4>
                                <p className="text-xs text-gray-500 mb-3">
                                    Enter your personal Telegram Chat ID so the bot can DM you when a complaint or cancellation arrives.{' '}
                                    <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                                        Find your Chat ID via @userinfobot
                                    </a>
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={ownerChatId}
                                        onChange={e => setOwnerChatId(e.target.value)}
                                        placeholder="e.g. 123456789"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button
                                        onClick={handleSaveOwnerChatId}
                                        disabled={savingChatId || !ownerChatId}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {savingChatId ? <Loader2 size={14} className="animate-spin" /> : chatIdSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                                        {chatIdSaved ? 'Saved!' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Facebook Messenger Integration */}
                        <div className="p-4 border border-gray-200 rounded-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <Facebook size={24} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Facebook Messenger</h3>
                                        <p className="text-sm text-gray-500">Connect your Facebook Page</p>
                                    </div>
                                </div>
                                {business?.fb_page_id ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg">
                                        <CheckCircle2 size={16} />
                                        <span className="text-sm font-medium">Connected</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-500 rounded-lg">
                                        <XCircle size={16} />
                                        <span className="text-sm font-medium">Not Connected</span>
                                    </div>
                                )}
                            </div>

                            {business?.fb_page_id ? (
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Connected Page</p>
                                            <p className="text-sm text-gray-600 mt-1">{business.fb_page_name}</p>
                                            <p className="text-xs text-gray-500 mt-1">Page ID: {business.fb_page_id}</p>
                                        </div>
                                        <ConfirmButton
                                            label="Disconnect"
                                            confirmLabel="Yes, Disconnect"
                                            onConfirm={handleDisconnectFacebook}
                                            disabled={saving}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4">
                                    <FacebookConnectButton businessId={business?.id || ''} onSuccess={fetchBusinessSettings} />
                                </div>
                            )}
                        </div>

                        {/* Google Calendar Integration */}
                        <div className="p-4 border border-gray-200 rounded-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                                        <Calendar size={24} className="text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Google Calendar</h3>
                                        <p className="text-sm text-gray-500">Enable AI-powered appointment booking</p>
                                    </div>
                                </div>
                                {business?.has_google_calendar ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg">
                                        <CheckCircle2 size={16} />
                                        <span className="text-sm font-medium">Connected</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-500 rounded-lg">
                                        <XCircle size={16} />
                                        <span className="text-sm font-medium">Not Connected</span>
                                    </div>
                                )}
                            </div>

                            {business?.has_google_calendar ? (
                                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Calendar Connected</p>
                                            {business.google_calendar_email && (
                                                <p className="text-xs text-gray-500 mt-1">{business.google_calendar_email}</p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1">Customers can book appointments via chat</p>
                                        </div>
                                        <ConfirmButton
                                            label="Disconnect"
                                            confirmLabel="Yes, Disconnect"
                                            onConfirm={handleDisconnectGoogleCalendar}
                                            disabled={saving}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4">
                                    <a
                                        href="/api/auth/google"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 48 48">
                                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                                        </svg>
                                        Connect Google Calendar
                                    </a>
                                    <p className="text-xs text-gray-400 mt-2">Requires Google account with calendar access</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── AI Budget ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <DollarSign size={20} className="text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">AI Budget</h2>
                            <p className="text-sm text-gray-500">Monthly spending limit for AI responses</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Usage bar */}
                        {(() => {
                            const cap = parseFloat(monthlyBudget) || 0;
                            const pct = cap > 0 ? Math.min(100, (currentUsage / cap) * 100) : 0;
                            const barColor = pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-green-500';
                            return (
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">This month&apos;s usage</span>
                                        <span className="font-medium text-gray-900">
                                            ${currentUsage.toFixed(4)} / ${cap.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    {pct >= 80 && (
                                        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                                            <AlertTriangle size={11} /> Usage above 80% — consider raising the limit.
                                        </p>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Budget input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Monthly limit (USD)
                            </label>
                            <div className="flex gap-3 items-center">
                                <div className="relative flex-1 max-w-xs">
                                    <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10000"
                                        step="1"
                                        value={monthlyBudget}
                                        onChange={e => setMonthlyBudget(e.target.value)}
                                        className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="10"
                                    />
                                </div>
                                <button
                                    onClick={handleSaveBudget}
                                    disabled={savingBudget}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {savingBudget ? <Loader2 size={14} className="animate-spin" /> : budgetSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                                    {budgetSaved ? 'Saved!' : 'Save'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                Set to 0 to disable the limit. AI calls that would exceed the limit are blocked.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Bot Settings (C2) ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Bot size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Bot Settings</h2>
                            <p className="text-sm text-gray-500">Customise your AI assistant's name, greeting, and tone</p>
                        </div>
                    </div>
                    <div className="space-y-4 max-w-lg">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bot Name</label>
                                <input type="text" value={botName} onChange={e => setBotName(e.target.value)}
                                    placeholder="e.g. Layla, Nimal, Booking Bot"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                                <select value={botTone} onChange={e => setBotTone(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="friendly">Friendly</option>
                                    <option value="professional">Professional</option>
                                    <option value="casual">Casual</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Custom Greeting <span className="text-gray-400 font-normal">(optional — use {'{bot_name}'} as placeholder)</span>
                            </label>
                            <textarea value={botGreeting} onChange={e => setBotGreeting(e.target.value)}
                                placeholder="Hi! I'm {bot_name}. How can I help you today?"
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                        </div>
                        <button
                            onClick={async () => {
                                setSavingBot(true); setBotSaved(false);
                                if (await patchSettings({ bot_name: botName.trim() || 'Assistant', bot_greeting: botGreeting.trim() || null, bot_tone: botTone })) {
                                    setBotSaved(true); setTimeout(() => setBotSaved(false), 3000);
                                }
                                setSavingBot(false);
                            }}
                            disabled={savingBot}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50">
                            {savingBot ? <Loader2 size={14} className="animate-spin" /> : botSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                            {botSaved ? 'Saved!' : 'Save Bot Settings'}
                        </button>
                    </div>
                </div>

                {/* ── Reminder Schedule (B6) ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Bell size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Reminder Schedule</h2>
                            <p className="text-sm text-gray-500">When should customers receive appointment reminders?</p>
                        </div>
                    </div>
                    <div className="space-y-3 max-w-md">
                        <div className="flex flex-wrap gap-2">
                            {[...reminderHours].sort((a, b) => b - a).map(h => (
                                <span key={h} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 font-medium">
                                    {h >= 24 ? `${h / 24}d` : `${h}h`} before
                                    <button onClick={() => setReminderHours(prev => prev.filter(x => x !== h))}
                                        className="ml-1 text-blue-400 hover:text-blue-700"><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="number" value={reminderInput} onChange={e => setReminderInput(e.target.value)}
                                placeholder="Hours before (e.g. 48, 24, 2, 1)"
                                min={1} max={720} step={1}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
                            <button onClick={() => {
                                const h = parseInt(reminderInput);
                                if (h > 0 && !reminderHours.includes(h)) { setReminderHours(p => [...p, h]); setReminderInput(''); }
                            }} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">
                                <Plus size={14} /> Add
                            </button>
                        </div>
                        <button
                            onClick={async () => {
                                setSavingReminders(true); setRemindersSaved(false);
                                if (await patchSettings({ reminder_hours: reminderHours })) {
                                    setRemindersSaved(true); setTimeout(() => setRemindersSaved(false), 3000);
                                }
                                setSavingReminders(false);
                            }}
                            disabled={savingReminders || reminderHours.length === 0}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50">
                            {savingReminders ? <Loader2 size={14} className="animate-spin" /> : remindersSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                            {remindersSaved ? 'Saved!' : 'Save Reminder Schedule'}
                        </button>
                    </div>
                </div>

                {/* ── Blocked Dates (B1) ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <Ban size={20} className="text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Blocked Dates</h2>
                            <p className="text-sm text-gray-500">Mark holidays or closure days — the bot will not offer slots on these dates</p>
                        </div>
                    </div>
                    <div className="space-y-4 max-w-lg">
                        {/* Add new blackout */}
                        <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                                <input type="date" value={blackoutDate} onChange={e => setBlackoutDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400" />
                            </div>
                            <div className="col-span-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                                <input type="text" value={blackoutLabel} onChange={e => setBlackoutLabel(e.target.value)}
                                    placeholder="e.g. Public Holiday"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400" />
                            </div>
                            <div className="col-span-2 flex items-center gap-1 pb-2">
                                <input type="checkbox" id="repeat" checked={blackoutRepeat} onChange={e => setBlackoutRepeat(e.target.checked)} className="rounded" />
                                <label htmlFor="repeat" className="text-xs text-gray-600">Yearly</label>
                            </div>
                            <div className="col-span-2">
                                <button
                                    onClick={async () => {
                                        if (!blackoutDate) return;
                                        setSavingBlackout(true);
                                        try {
                                            const res = await fetch('/api/blackouts', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ date: blackoutDate, label: blackoutLabel || 'Closed', repeat_annually: blackoutRepeat }),
                                            });
                                            if (res.ok) {
                                                const added = await res.json();
                                                setBlackouts(p => [...p.filter(b => b.date !== blackoutDate), added].sort((a, b) => a.date.localeCompare(b.date)));
                                                setBlackoutDate('');
                                            }
                                        } finally { setSavingBlackout(false); }
                                    }}
                                    disabled={!blackoutDate || savingBlackout}
                                    className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1">
                                    {savingBlackout ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
                                </button>
                            </div>
                        </div>
                        {/* Blackout list */}
                        {blackouts.length > 0 && (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {blackouts.map(b => (
                                    <div key={b.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                        <div>
                                            <span className="text-sm font-medium text-gray-800">{b.date}</span>
                                            <span className="mx-2 text-gray-300">·</span>
                                            <span className="text-sm text-gray-600">{b.label}</span>
                                            {b.repeat_annually && <span className="ml-2 text-xs text-red-500">(repeats yearly)</span>}
                                        </div>
                                        <button onClick={async () => {
                                            await fetch(`/api/blackouts?id=${b.id}`, { method: 'DELETE' });
                                            setBlackouts(p => p.filter(x => x.id !== b.id));
                                        }} className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {blackouts.length === 0 && (
                            <p className="text-sm text-gray-400 italic">No blocked dates yet</p>
                        )}
                    </div>
                </div>

                {/* ── Account Settings ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            <Shield size={20} className="text-gray-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Account Settings</h2>
                            <p className="text-sm text-gray-500">Manage your account preferences</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => { setShowPasswordModal(true); setPasswordError(''); setPasswordSuccess(false); }}
                            className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <h3 className="font-medium text-gray-900">Change Password</h3>
                            <p className="text-sm text-gray-500 mt-1">Update your account password</p>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Change Password Modal ── */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {passwordSuccess ? (
                            <div className="flex flex-col items-center py-6 gap-3">
                                <CheckCircle2 size={40} className="text-green-500" />
                                <p className="text-gray-700 font-medium">Password updated successfully!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                    <div className="relative">
                                        <input
                                            type={showCurrent ? 'text' : 'password'}
                                            value={passwordForm.current}
                                            onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg pr-10 outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Enter current password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrent(v => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showNext ? 'text' : 'password'}
                                            value={passwordForm.next}
                                            onChange={e => setPasswordForm(f => ({ ...f, next: e.target.value }))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg pr-10 outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="At least 8 characters"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNext(v => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {/* Password strength indicator */}
                                    {passwordForm.next.length > 0 && (
                                        <div className="mt-2">
                                            <div className="flex gap-1 mb-1">
                                                {[1, 2, 3, 4].map(level => {
                                                    const strength = getPasswordStrength(passwordForm.next);
                                                    return (
                                                        <div
                                                            key={level}
                                                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                                                                level <= strength
                                                                    ? strength === 1 ? 'bg-red-500'
                                                                    : strength === 2 ? 'bg-orange-400'
                                                                    : strength === 3 ? 'bg-yellow-400'
                                                                    : 'bg-green-500'
                                                                    : 'bg-gray-200'
                                                            }`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                {['', 'Weak', 'Fair', 'Good', 'Strong'][getPasswordStrength(passwordForm.next)]}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={passwordForm.confirm}
                                        onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Repeat new password"
                                    />
                                </div>

                                {passwordError && (
                                    <p className="text-sm text-red-600">{passwordError}</p>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowPasswordModal(false)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={savingPassword || !passwordForm.current || !passwordForm.next || !passwordForm.confirm}
                                        className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                    >
                                        {savingPassword ? <Loader2 size={14} className="animate-spin" /> : null}
                                        {savingPassword ? 'Saving...' : 'Update Password'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Returns a 1-4 strength score for a password */
function getPasswordStrength(pwd: string): number {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;
    return Math.max(1, Math.min(4, score));
}

import FacebookConnectButton from '@/components/dashboard/FacebookConnectButton';
import TelegramConnectButton from '@/components/dashboard/TelegramConnectButton';
