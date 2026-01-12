'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Check } from 'lucide-react';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();
                setSettings(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchSettings();
    }, []);

    async function handleSave() {
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                alert('Settings saved successfully!');
            } else {
                alert('Failed to save settings');
            }
        } catch (err) {
            alert('Error saving settings');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-12 text-center text-gray-500">Loading settings...</div>;
    if (!settings) return <div className="p-12 text-center text-gray-500">Error loading settings</div>;

    // Ensure business_hours has defaults if null
    const hours = settings.business_hours || {};
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const isCalendarConnected = !!settings.google_calendar_token;
    const isTelegramConnected = !!settings.telegram_bot_token;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-500 mt-1">Manage your business profile and preferences.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                    {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    Save Changes
                </button>
            </div>

            <div className="space-y-6">
                {/* Profile Section */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-3">Business Profile</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                            <input
                                value={settings.name || ''}
                                onChange={e => setSettings({ ...settings, name: e.target.value })}
                                type="text"
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                            <input
                                value={settings.phone || ''}
                                onChange={e => setSettings({ ...settings, phone: e.target.value })}
                                type="text"
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={settings.description || ''}
                                onChange={e => setSettings({ ...settings, description: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                            />
                        </div>
                    </div>
                </section>

                {/* Integrations */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-3">Integrations</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1024px-Google_Calendar_icon_%282020%29.svg.png" alt="Google" className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900">Google Calendar</h4>
                                    <p className="text-xs text-gray-500">
                                        {isCalendarConnected ? 'Connected' : 'Not Connected'}
                                    </p>
                                </div>
                            </div>
                            {isCalendarConnected ? (
                                <span className="text-green-600 flex items-center gap-1 text-sm font-medium"><Check size={16} /> Connected</span>
                            ) : (
                                <a href="/connect" className="text-sm text-indigo-600 font-medium hover:underline">Connect Now</a>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.06-.14-.04-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.4-1.08.39-.35-.01-1.03-.2-1.54-.35-.62-.18-1.12-.28-1.07-.59.02-.16.24-.32.65-.48 2.56-1.11 4.26-1.85 5.1-2.2 2.41-1.01 2.91-1.19 3.23-1.19.07 0 .23.01.33.08.08.06.12.14.16.24.04.1.04.23.04.34z" /></svg>
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900">Telegram Bot</h4>
                                    <p className="text-xs text-gray-500">
                                        {isTelegramConnected ? 'Active' : 'No Token Found'}
                                    </p>
                                </div>
                            </div>
                            <button disabled className="text-sm text-gray-400 font-medium">Managed by Admin</button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
