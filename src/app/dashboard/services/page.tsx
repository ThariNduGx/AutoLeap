'use client';

import { useState, useEffect } from 'react';
import {
    Plus, Pencil, Trash2, Loader2, CheckCircle2, Briefcase, Clock,
    ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Tag,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tier {
    name: string;
    price: number;
    duration_minutes?: number;
}

interface Service {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    buffer_minutes: number;
    min_advance_hours: number;
    price: number | null;
    currency: string;
    tiers: Tier[];
    is_active: boolean;
    sort_order: number;
}

const EMPTY_TIER: Tier = { name: '', price: 0 };

const EMPTY_FORM = {
    name: '',
    description: '',
    duration_minutes: '60',
    buffer_minutes: '0',
    min_advance_hours: '0',
    currency: 'LKR',
};

const CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'INR', 'AUD'];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [tiers, setTiers] = useState<Tier[]>([]);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const fetchServices = async () => {
        try {
            const res = await fetch('/api/services');
            if (!res.ok) throw new Error('Failed to load');
            setServices(await res.json());
        } catch {
            setError('Failed to load services');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchServices(); }, []);

    // ── Form helpers ──────────────────────────────────────────────────────────

    function openCreate() {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setTiers([]);
        setFormError('');
        setShowForm(true);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    }

    function openEdit(svc: Service) {
        setEditingId(svc.id);
        setForm({
            name: svc.name,
            description: svc.description ?? '',
            duration_minutes: String(svc.duration_minutes),
            buffer_minutes: String(svc.buffer_minutes ?? 0),
            min_advance_hours: String(svc.min_advance_hours ?? 0),
            currency: svc.currency || 'LKR',
        });
        setTiers(svc.tiers ? svc.tiers.map(t => ({ ...t })) : []);
        setFormError('');
        setShowForm(true);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    }

    // ── Tier editing ──────────────────────────────────────────────────────────

    function addTier() {
        setTiers(prev => [...prev, { ...EMPTY_TIER }]);
    }

    function removeTier(idx: number) {
        setTiers(prev => prev.filter((_, i) => i !== idx));
    }

    function updateTier(idx: number, field: keyof Tier, value: string) {
        setTiers(prev => prev.map((t, i) => {
            if (i !== idx) return t;
            if (field === 'price') return { ...t, price: parseFloat(value) || 0 };
            if (field === 'duration_minutes') {
                const v = value === '' ? undefined : parseInt(value);
                return { ...t, duration_minutes: v };
            }
            return { ...t, [field]: value };
        }));
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const name = form.name.trim();
        if (!name) { setFormError('Service name is required'); return; }

        const duration = parseInt(form.duration_minutes);
        if (isNaN(duration) || duration < 5 || duration > 480) {
            setFormError('Duration must be between 5 and 480 minutes');
            return;
        }

        // Validate tiers
        for (let i = 0; i < tiers.length; i++) {
            if (!tiers[i].name.trim()) {
                setFormError(`Tier ${i + 1} is missing a name`); return;
            }
            if (isNaN(tiers[i].price) || tiers[i].price < 0) {
                setFormError(`Tier ${i + 1} has an invalid price`); return;
            }
        }

        setSaving(true);
        setFormError('');
        try {
            const cleanTiers: Tier[] = tiers.map(t => {
                const tier: Tier = { name: t.name.trim(), price: t.price };
                if (t.duration_minutes && t.duration_minutes >= 5) tier.duration_minutes = t.duration_minutes;
                return tier;
            });

            const bufferMinutes = parseInt(form.buffer_minutes) || 0;
        const minAdvanceHours = parseInt(form.min_advance_hours) || 0;

        const body = {
                name,
                description: form.description.trim() || null,
                duration_minutes: duration,
                buffer_minutes: bufferMinutes,
                min_advance_hours: minAdvanceHours,
                currency: form.currency,
                tiers: cleanTiers,
            };

            const url = editingId ? `/api/services?id=${editingId}` : '/api/services';
            const method = editingId ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                setFormError(data.error || 'Failed to save');
                return;
            }
            setShowForm(false);
            await fetchServices();
        } finally {
            setSaving(false);
        }
    }

    // ── List actions ──────────────────────────────────────────────────────────

    async function toggleActive(svc: Service) {
        await fetch(`/api/services?id=${svc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !svc.is_active }),
        });
        await fetchServices();
    }

    async function handleDelete(svc: Service) {
        if (!confirm(`Delete "${svc.name}"? This cannot be undone.`)) return;
        const res = await fetch(`/api/services?id=${svc.id}`, { method: 'DELETE' });
        if (res.ok) {
            const data = await res.json();
            if (data.softDeleted) {
                alert(`"${svc.name}" has ${data.appointmentCount} existing appointment(s) and was deactivated instead of deleted. You can reactivate it using the toggle.`);
            }
        }
        await fetchServices();
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="p-6 max-w-3xl mx-auto">

            {/* Page header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Services & Pricing</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Define your services and pricing tiers — the AI bot will present these to customers
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <Plus size={16} /> Add Service
                </button>
            </div>

            {/* Empty notice */}
            {!loading && services.length === 0 && !showForm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
                    <strong>No services defined yet.</strong> Add your first service — the AI will automatically show
                    your menu (with pricing tiers) to customers when they ask about services or prices.
                </div>
            )}

            {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

            {/* ── Create / Edit form ─────────────────────────────────────────── */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6 mb-6">
                    <h2 className="text-base font-semibold text-gray-900 mb-4">
                        {editingId ? 'Edit Service' : 'New Service'}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Basic info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Facial Cleanup, Haircut, Consultation"
                                    maxLength={100}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Brief description shown to customers…"
                                    rows={2}
                                    maxLength={300}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Duration (min) *</label>
                                <input
                                    type="number"
                                    value={form.duration_minutes}
                                    onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                                    min={5} max={480} step={5}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                                <select
                                    value={form.currency}
                                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                                >
                                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Buffer After Appointment (min)
                                </label>
                                <input
                                    type="number"
                                    value={form.buffer_minutes}
                                    onChange={e => setForm(f => ({ ...f, buffer_minutes: e.target.value }))}
                                    min={0} max={120} step={5}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">Prep/cleanup gap before next booking</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Min. Advance Notice (hours)
                                </label>
                                <input
                                    type="number"
                                    value={form.min_advance_hours}
                                    onChange={e => setForm(f => ({ ...f, min_advance_hours: e.target.value }))}
                                    min={0} max={168} step={1}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">Earliest slot offered = now + this many hours</p>
                            </div>
                        </div>

                        {/* ── Pricing tiers ──────────────────────────────────── */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Pricing Tiers / Packages</p>
                                    <p className="text-xs text-gray-400">
                                        Add tiers if this service has multiple options (e.g. Normal / Hydra / Gold Cleanup).
                                        Leave empty to let customers book without a package choice.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addTier}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                >
                                    <Plus size={13} /> Add Tier
                                </button>
                            </div>

                            {tiers.length === 0 ? (
                                <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">
                                    No pricing tiers yet — click <strong>Add Tier</strong> to create packages
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Column headers */}
                                    <div className="grid grid-cols-12 gap-2 px-1">
                                        <span className="col-span-5 text-xs text-gray-400 font-medium">Tier / Package Name</span>
                                        <span className="col-span-3 text-xs text-gray-400 font-medium">Price ({form.currency})</span>
                                        <span className="col-span-3 text-xs text-gray-400 font-medium">Duration (min)</span>
                                        <span className="col-span-1" />
                                    </div>

                                    {tiers.map((tier, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                                            <input
                                                type="text"
                                                value={tier.name}
                                                onChange={e => updateTier(idx, 'name', e.target.value)}
                                                placeholder={`e.g. Tier ${idx + 1}`}
                                                maxLength={80}
                                                className="col-span-5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                            />
                                            <input
                                                type="number"
                                                value={tier.price}
                                                onChange={e => updateTier(idx, 'price', e.target.value)}
                                                min={0}
                                                step={50}
                                                placeholder="0"
                                                className="col-span-3 px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                            />
                                            <input
                                                type="number"
                                                value={tier.duration_minutes ?? ''}
                                                onChange={e => updateTier(idx, 'duration_minutes', e.target.value)}
                                                min={5}
                                                max={480}
                                                step={5}
                                                placeholder="default"
                                                className="col-span-3 px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeTier(idx)}
                                                className="col-span-1 flex justify-center text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {formError && <p className="text-sm text-red-600">{formError}</p>}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                {editingId ? 'Update Service' : 'Create Service'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Services list ──────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 size={32} className="animate-spin text-gray-300" />
                </div>
            ) : (
                <div className="space-y-3">
                    {services.map(svc => (
                        <ServiceCard
                            key={svc.id}
                            svc={svc}
                            expanded={expandedId === svc.id}
                            onToggleExpand={() => setExpandedId(expandedId === svc.id ? null : svc.id)}
                            onEdit={() => openEdit(svc)}
                            onToggleActive={() => toggleActive(svc)}
                            onDelete={() => handleDelete(svc)}
                        />
                    ))}
                </div>
            )}

            {!loading && services.length > 0 && (
                <p className="text-xs text-gray-400 mt-6 text-center">
                    Active services + pricing tiers are shown to customers by the AI booking bot.
                    Inactive services are hidden.
                </p>
            )}
        </div>
    );
}

// ─── Service card ──────────────────────────────────────────────────────────────

function ServiceCard({
    svc,
    expanded,
    onToggleExpand,
    onEdit,
    onToggleActive,
    onDelete,
}: {
    svc: Service;
    expanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onToggleActive: () => void;
    onDelete: () => void;
}) {
    const hasTiers = svc.tiers && svc.tiers.length > 0;
    const currency = svc.currency || 'LKR';

    const priceRange = () => {
        if (!hasTiers) return svc.price != null ? `${currency} ${Number(svc.price).toLocaleString()}` : null;
        const prices = svc.tiers.map(t => t.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return min === max
            ? `${currency} ${min.toLocaleString()}`
            : `${currency} ${min.toLocaleString()} – ${max.toLocaleString()}`;
    };

    return (
        <div className={`bg-white rounded-xl border shadow-sm transition-opacity ${svc.is_active ? 'border-gray-200 opacity-100' : 'border-gray-100 opacity-60'}`}>
            {/* Header row */}
            <div className="flex items-start gap-4 p-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${svc.is_active ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                    <Briefcase size={18} className={svc.is_active ? 'text-indigo-600' : 'text-gray-400'} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-sm">{svc.name}</h3>
                        {!svc.is_active && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Inactive</span>
                        )}
                        {hasTiers && (
                            <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full flex items-center gap-1">
                                <Tag size={9} /> {svc.tiers.length} tier{svc.tiers.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    {svc.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{svc.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock size={11} /> {svc.duration_minutes} min
                        </span>
                        {(svc.buffer_minutes ?? 0) > 0 && (
                            <span className="text-xs text-gray-400">+{svc.buffer_minutes}min buffer</span>
                        )}
                        {(svc.min_advance_hours ?? 0) > 0 && (
                            <span className="text-xs text-gray-400">{svc.min_advance_hours}h notice req.</span>
                        )}
                        {priceRange() && (
                            <span className="text-xs font-semibold text-indigo-700">{priceRange()}</span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    {hasTiers && (
                        <button
                            onClick={onToggleExpand}
                            title="View tiers"
                            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                    )}
                    <button
                        onClick={onToggleActive}
                        title={svc.is_active ? 'Deactivate' : 'Activate'}
                        className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        {svc.is_active
                            ? <ToggleRight size={18} className="text-indigo-500" />
                            : <ToggleLeft size={18} />}
                    </button>
                    <button
                        onClick={onEdit}
                        title="Edit"
                        className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <Pencil size={15} />
                    </button>
                    <button
                        onClick={onDelete}
                        title="Delete"
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* Tiers expanded view */}
            {expanded && hasTiers && (
                <div className="border-t border-gray-100 px-4 pb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-2">Pricing Tiers</p>
                    <div className="space-y-1.5">
                        {svc.tiers.map((t, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    {t.duration_minutes && (
                                        <span className="flex items-center gap-1">
                                            <Clock size={10} /> {t.duration_minutes} min
                                        </span>
                                    )}
                                    <span className="font-semibold text-indigo-700 text-sm">
                                        {currency} {Number(t.price).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
