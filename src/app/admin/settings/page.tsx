'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Settings, DollarSign, Bot, Megaphone } from 'lucide-react';

const AI_MODELS = [
    { value: 'gemini-flash-latest', label: 'Gemini Flash (default — fast & cheap)' },
    { value: 'gemini-pro',          label: 'Gemini Pro (more capable, higher cost)' },
];

interface PlatformSettings {
    default_monthly_budget_usd: string;
    default_ai_model: string;
    global_announcement: string;
}

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<PlatformSettings>({
        default_monthly_budget_usd: '10',
        default_ai_model: 'gemini-flash-latest',
        global_announcement: '',
    });
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [saved, setSaved]       = useState(false);
    const [error, setError]       = useState('');

    useEffect(() => { fetchSettings(); }, []);

    async function fetchSettings() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings(prev => ({ ...prev, ...data.settings }));
            }
        } catch {
            setError('Failed to load settings');
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
            const res = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) {
                const d = await res.json();
                setError(d.error || 'Save failed');
            } else {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch {
            setError('Network error');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="p-8 max-w-3xl mx-auto">
                <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Settings size={22} className="text-red-500" />
                        Platform Settings
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        System-wide defaults applied to all businesses.
                    </p>
                </div>
                <button
                    onClick={fetchSettings}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {/* Default Monthly Budget */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-gray-800 font-semibold">
                    <DollarSign size={16} className="text-green-600" />
                    Default Monthly AI Budget
                </div>
                <p className="text-sm text-gray-500">
                    Applied automatically when a new business signs up. Business owners can adjust
                    their own limit in Settings → AI Budget.
                </p>
                <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm">$</span>
                    <input
                        type="number"
                        min={1}
                        max={1000}
                        step={1}
                        value={settings.default_monthly_budget_usd}
                        onChange={e => setSettings(s => ({ ...s, default_monthly_budget_usd: e.target.value }))}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-500">USD / month</span>
                </div>
            </div>

            {/* Default AI Model */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-gray-800 font-semibold">
                    <Bot size={16} className="text-indigo-600" />
                    Default AI Model
                </div>
                <p className="text-sm text-gray-500">
                    Model used for all new businesses. Existing businesses keep their assigned model
                    unless manually changed.
                </p>
                <select
                    value={settings.default_ai_model}
                    onChange={e => setSettings(s => ({ ...s, default_ai_model: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-red-500 bg-white"
                >
                    {AI_MODELS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
            </div>

            {/* Global Announcement */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-gray-800 font-semibold">
                    <Megaphone size={16} className="text-amber-600" />
                    Global Announcement
                </div>
                <p className="text-sm text-gray-500">
                    Shown as a banner on the business owner dashboard. Leave blank to hide.
                    Useful for maintenance notices or new feature announcements.
                </p>
                <textarea
                    rows={3}
                    value={settings.global_announcement}
                    onChange={e => setSettings(s => ({ ...s, global_announcement: e.target.value }))}
                    placeholder="e.g. Scheduled maintenance on Sunday 2–4 AM UTC. The bot will be temporarily offline."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
                {settings.global_announcement && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
                        <span className="font-medium">Preview: </span>{settings.global_announcement}
                    </div>
                )}
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving…' : 'Save Settings'}
                </button>
                {saved && (
                    <span className="text-sm text-green-600 font-medium">✓ Settings saved</span>
                )}
            </div>
        </div>
    );
}
