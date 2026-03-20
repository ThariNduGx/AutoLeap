'use client';

import { useState, useEffect } from 'react';
import { Building2, MessageSquare, Facebook, User, Shield, Save, Loader2, CheckCircle2, XCircle, X, Eye, EyeOff, Calendar } from 'lucide-react';

interface BusinessSettings {
    id: string;
    name: string;
    telegram_bot_token: string | null;
    fb_page_id: string | null;
    fb_page_name: string | null;
    owner_telegram_chat_id: string | null;
    has_google_calendar: boolean;
    google_calendar_email: string | null;
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
            const res = await fetch('/api/business/settings');
            const data = await res.json();
            if (data.success) {
                setBusiness(data.business);
                setBusinessName(data.business.name || '');
                setOwnerChatId(data.business.owner_telegram_chat_id || '');
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveBusinessName() {
        if (!businessName.trim()) return;
        setSavingName(true);
        setNameSaved(false);
        try {
            const res = await fetch('/api/business/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: businessName.trim() }),
            });
            if (res.ok) {
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
            const res = await fetch('/api/business/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner_telegram_chat_id: ownerChatId }),
            });
            if (res.ok) {
                setChatIdSaved(true);
                setTimeout(() => setChatIdSaved(false), 3000);
            }
        } finally {
            setSavingChatId(false);
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
        if (!confirm('Are you sure you want to disconnect Google Calendar? Booking features will stop working.')) return;
        setSaving(true);
        try {
            const res = await fetch('/api/business/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ disconnect_google_calendar: true }),
            });
            if (res.ok) {
                fetchBusinessSettings();
            } else {
                alert('Failed to disconnect Google Calendar');
            }
        } catch {
            alert('Error disconnecting Google Calendar');
        } finally {
            setSaving(false);
        }
    }

    async function handleDisconnectFacebook() {
        if (!confirm('Are you sure you want to disconnect your Facebook Page?')) return;
        setSaving(true);
        try {
            const res = await fetch('/api/business/settings/facebook/disconnect', { method: 'POST' });
            if (res.ok) {
                fetchBusinessSettings();
            } else {
                alert('Failed to disconnect Facebook Page');
            }
        } catch {
            alert('Error disconnecting Facebook Page');
        } finally {
            setSaving(false);
        }
    }

    async function handleDisconnectTelegram() {
        if (!confirm('Are you sure you want to disconnect your Telegram bot?')) return;
        setSaving(true);
        try {
            const res = await fetch('/api/telegram/disconnect', { method: 'POST' });
            if (res.ok) {
                fetchBusinessSettings();
            } else {
                alert('Failed to disconnect Telegram bot');
            }
        } catch {
            alert('Error disconnecting Telegram bot');
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
                {/* Business Profile Section */}
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

                {/* Integrations Section */}
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
                                        <button
                                            onClick={handleDisconnectTelegram}
                                            disabled={saving}
                                            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Disconnect'}
                                        </button>
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
                                <h4 className="text-sm font-semibold text-gray-900 mb-1">Receive Complaint Alerts</h4>
                                <p className="text-xs text-gray-500 mb-3">
                                    Enter your personal Telegram Chat ID so the bot can DM you when a complaint arrives.{' '}
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
                                        <button
                                            onClick={handleDisconnectFacebook}
                                            disabled={saving}
                                            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Disconnect'}
                                        </button>
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
                                        <button
                                            onClick={handleDisconnectGoogleCalendar}
                                            disabled={saving}
                                            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Disconnect'}
                                        </button>
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

                {/* Account Settings Section */}
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

            {/* Change Password Modal */}
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
                                {/* Current Password */}
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

                                {/* New Password */}
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
                                </div>

                                {/* Confirm New Password */}
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

import FacebookConnectButton from '@/components/dashboard/FacebookConnectButton';
import TelegramConnectButton from '@/components/dashboard/TelegramConnectButton';
