'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, CheckCircle2, Briefcase, DollarSign, Clock, ToggleLeft, ToggleRight } from 'lucide-react';

interface Service {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number | null;
    is_active: boolean;
    sort_order: number;
}

const EMPTY_FORM = { name: '', description: '', duration_minutes: '60', price: '' };

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
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

    function openCreate() {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setShowForm(true);
    }

    function openEdit(svc: Service) {
        setEditingId(svc.id);
        setForm({
            name: svc.name,
            description: svc.description ?? '',
            duration_minutes: String(svc.duration_minutes),
            price: svc.price != null ? String(svc.price) : '',
        });
        setFormError('');
        setShowForm(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const name = form.name.trim();
        if (!name) { setFormError('Name is required'); return; }
        const duration = parseInt(form.duration_minutes);
        if (isNaN(duration) || duration < 5 || duration > 480) {
            setFormError('Duration must be between 5 and 480 minutes');
            return;
        }

        setSaving(true);
        setFormError('');
        try {
            const body = {
                name,
                description: form.description.trim() || null,
                duration_minutes: duration,
                price: form.price !== '' ? parseFloat(form.price) : null,
            };

            let res: Response;
            if (editingId) {
                res = await fetch(`/api/services?id=${editingId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
            } else {
                res = await fetch('/api/services', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
            }

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

    async function toggleActive(svc: Service) {
        await fetch(`/api/services?id=${svc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !svc.is_active }),
        });
        await fetchServices();
    }

    async function handleDelete(svc: Service) {
        if (!confirm(`Delete service "${svc.name}"? This cannot be undone.`)) return;
        await fetch(`/api/services?id=${svc.id}`, { method: 'DELETE' });
        await fetchServices();
    }

    return (
        <div className="p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Services</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Define the services your AI booking agent will offer to customers
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <Plus size={16} /> Add Service
                </button>
            </div>

            {/* Notice if no services */}
            {!loading && services.length === 0 && !showForm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
                    <strong>No services defined yet.</strong> Add your first service so the AI can present a booking menu to customers.
                    Without services, the bot falls back to asking customers to describe what they need.
                </div>
            )}

            {/* Error */}
            {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

            {/* Create / Edit Form */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
                    <h2 className="text-base font-semibold text-gray-900 mb-4">
                        {editingId ? 'Edit Service' : 'New Service'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Haircut, Consultation, Full Body Massage"
                                maxLength={100}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                        <div>
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
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes) *</label>
                                <input
                                    type="number"
                                    value={form.duration_minutes}
                                    onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                                    min={5}
                                    max={480}
                                    step={5}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price (optional)</label>
                                <input
                                    type="number"
                                    value={form.price}
                                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                    placeholder="e.g. 25.00"
                                    min={0}
                                    step={0.01}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>
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

            {/* Services list */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 size={32} className="animate-spin text-gray-300" />
                </div>
            ) : (
                <div className="space-y-3">
                    {services.map(svc => (
                        <div
                            key={svc.id}
                            className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-4 transition-opacity ${svc.is_active ? 'border-gray-200 opacity-100' : 'border-gray-100 opacity-60'}`}
                        >
                            {/* Icon */}
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${svc.is_active ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                <Briefcase size={18} className={svc.is_active ? 'text-indigo-600' : 'text-gray-400'} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold text-gray-900 text-sm">{svc.name}</h3>
                                    {!svc.is_active && (
                                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Inactive</span>
                                    )}
                                </div>
                                {svc.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{svc.description}</p>
                                )}
                                <div className="flex items-center gap-4 mt-1.5">
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                        <Clock size={11} /> {svc.duration_minutes} min
                                    </span>
                                    {svc.price != null && (
                                        <span className="flex items-center gap-1 text-xs text-gray-500">
                                            <DollarSign size={11} /> {Number(svc.price).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => toggleActive(svc)}
                                    title={svc.is_active ? 'Deactivate' : 'Activate'}
                                    className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    {svc.is_active
                                        ? <ToggleRight size={18} className="text-indigo-500" />
                                        : <ToggleLeft size={18} />}
                                </button>
                                <button
                                    onClick={() => openEdit(svc)}
                                    title="Edit"
                                    className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <Pencil size={15} />
                                </button>
                                <button
                                    onClick={() => handleDelete(svc)}
                                    title="Delete"
                                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Help text */}
            {!loading && services.length > 0 && (
                <p className="text-xs text-gray-400 mt-6 text-center">
                    Active services are presented to customers as a booking menu. Inactive services are hidden from the bot.
                </p>
            )}
        </div>
    );
}
