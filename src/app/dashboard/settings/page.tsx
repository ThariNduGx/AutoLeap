'use client';

import { useState, useEffect } from 'react';
import { Building2, MessageSquare, Facebook, User, Shield, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface BusinessSettings {
    id: string;
    name: string;
    telegram_bot_token: string | null;
    fb_page_id: string | null;
    fb_page_name: string | null;
    owner_telegram_chat_id: string | null;
}

export default function SettingsPage() {
    const [business, setBusiness] = useState<BusinessSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ownerChatId, setOwnerChatId] = useState('');
    const [savingChatId, setSavingChatId] = useState(false);
    const [chatIdSaved, setChatIdSaved] = useState(false);

    useEffect(() => {
        fetchBusinessSettings();
    }, []);

    async function fetchBusinessSettings() {
        try {
            const res = await fetch('/api/business/settings');
            const data = await res.json();
            if (data.success) {
                setBusiness(data.business);
                setOwnerChatId(data.business.owner_telegram_chat_id || '');
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
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

    async function handleDisconnectFacebook() {
        if (!confirm('Are you sure you want to disconnect your Facebook Page?')) return;

        setSaving(true);
        try {
            const res = await fetch('/api/business/settings/facebook/disconnect', {
                method: 'POST',
            });

            if (res.ok) {
                fetchBusinessSettings(); // Refresh
            } else {
                alert('Failed to disconnect Facebook Page');
            }
        } catch (error) {
            alert('Error disconnecting Facebook Page');
        } finally {
            setSaving(false);
        }
    }

    async function handleDisconnectTelegram() {
        if (!confirm('Are you sure you want to disconnect your Telegram bot?')) return;

        setSaving(true);
        try {
            const res = await fetch('/api/telegram/disconnect', {
                method: 'POST',
            });

            if (res.ok) {
                fetchBusinessSettings(); // Refresh
            } else {
                alert('Failed to disconnect Telegram bot');
            }
        } catch (error) {
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
                            <input
                                type="text"
                                value={business?.name || ''}
                                disabled
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                            />
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
                        <button className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <h3 className="font-medium text-gray-900">Change Password</h3>
                            <p className="text-sm text-gray-500 mt-1">Update your account password</p>
                        </button>
                        <button className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <h3 className="font-medium text-gray-900">Email Notifications</h3>
                            <p className="text-sm text-gray-500 mt-1">Manage notification preferences</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

import FacebookConnectButton from '@/components/dashboard/FacebookConnectButton';
import TelegramConnectButton from '@/components/dashboard/TelegramConnectButton';
