'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, User, Phone, Loader2, ChevronRight, X, Calendar, Clock, StickyNote, AlertTriangle } from 'lucide-react';

interface Customer {
    id: string;
    phone: string;
    name: string;
    platform?: string;
    total_bookings: number;
    noshow_count: number;
    created_at: string;
    updated_at: string;
}

interface Appointment {
    id: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    price?: number;
    currency?: string;
    notes?: string;
}

interface CustomerDetail extends Customer {
    notes?: string;
    appointments: Appointment[];
}

const STATUS_COLOURS: Record<string, string> = {
    scheduled:  'bg-blue-100 text-blue-700',
    completed:  'bg-green-100 text-green-700',
    cancelled:  'bg-gray-100 text-gray-500',
    no_show:    'bg-red-100 text-red-600',
};

export default function CustomersPage() {
    const [customers, setCustomers]     = useState<Customer[]>([]);
    const [loading, setLoading]         = useState(true);
    const [search, setSearch]           = useState('');
    const [selected, setSelected]       = useState<CustomerDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [editingNotes, setEditingNotes]   = useState(false);
    const [notesValue, setNotesValue]       = useState('');
    const [savingNotes, setSavingNotes]     = useState(false);

    const fetchCustomers = useCallback(async (q = '') => {
        setLoading(true);
        try {
            const res = await fetch(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
            if (res.ok) setCustomers(await res.json());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchCustomers(search);
    };

    const openCustomer = async (c: Customer) => {
        setLoadingDetail(true);
        setSelected(null);
        try {
            const res = await fetch(`/api/customers?id=${c.id}`);
            if (res.ok) {
                const data = await res.json();
                setSelected(data);
                setNotesValue(data.notes || '');
            }
        } finally {
            setLoadingDetail(false);
        }
    };

    const saveNotes = async () => {
        if (!selected) return;
        setSavingNotes(true);
        try {
            const res = await fetch(`/api/customers?id=${selected.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: notesValue }),
            });
            if (res.ok) {
                setSelected(s => s ? { ...s, notes: notesValue } : s);
                setEditingNotes(false);
            }
        } finally {
            setSavingNotes(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
                <p className="text-sm text-gray-500 mt-0.5">Unified customer profiles — booking history, notes, and contact details</p>
            </div>

            <div className="flex gap-6">
                {/* Left: customer list */}
                <div className="w-80 flex-shrink-0">
                    <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                        <div className="flex-1 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Name or phone…"
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                            Search
                        </button>
                    </form>

                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
                    ) : customers.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-12">No customers yet</p>
                    ) : (
                        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                            {customers.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => openCustomer(c)}
                                    className={`w-full text-left p-3 rounded-xl border transition-colors ${selected?.id === c.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                <User size={14} className="text-indigo-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                                                <p className="text-xs text-gray-400">{c.phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                            <span className="text-xs text-gray-500">{c.total_bookings} bookings</span>
                                            {c.noshow_count > 0 && (
                                                <span className="text-xs text-red-500">{c.noshow_count} no-show</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: customer detail */}
                <div className="flex-1 min-w-0">
                    {loadingDetail && (
                        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>
                    )}

                    {!loadingDetail && !selected && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <User size={40} className="mb-3 text-gray-200" />
                            <p className="text-sm">Select a customer to view their profile</p>
                        </div>
                    )}

                    {!loadingDetail && selected && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            {/* Profile header */}
                            <div className="flex items-start justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                                        <User size={20} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-gray-900 text-lg">{selected.name}</h2>
                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                            <Phone size={12} /> {selected.phone}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3 text-center">
                                    <div className="bg-indigo-50 rounded-xl px-3 py-2">
                                        <p className="text-xl font-bold text-indigo-700">{selected.total_bookings}</p>
                                        <p className="text-xs text-gray-500">Bookings</p>
                                    </div>
                                    {selected.noshow_count > 0 && (
                                        <div className="bg-red-50 rounded-xl px-3 py-2">
                                            <p className="text-xl font-bold text-red-600">{selected.noshow_count}</p>
                                            <p className="text-xs text-gray-500">No-shows</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Owner notes */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <StickyNote size={11} /> Private Notes
                                    </p>
                                    {!editingNotes && (
                                        <button onClick={() => setEditingNotes(true)} className="text-xs text-indigo-600 hover:underline">
                                            {selected.notes ? 'Edit' : 'Add note'}
                                        </button>
                                    )}
                                </div>
                                {editingNotes ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={notesValue}
                                            onChange={e => setNotesValue(e.target.value)}
                                            rows={3}
                                            placeholder="Notes visible only to you…"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={saveNotes} disabled={savingNotes} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50">
                                                {savingNotes ? 'Saving…' : 'Save'}
                                            </button>
                                            <button onClick={() => { setEditingNotes(false); setNotesValue(selected.notes || ''); }} className="px-3 py-1.5 text-gray-600 text-xs rounded-lg hover:bg-gray-100">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className={`text-sm ${selected.notes ? 'text-gray-700 bg-gray-50 rounded-lg p-3' : 'text-gray-400 italic'}`}>
                                        {selected.notes || 'No notes yet'}
                                    </p>
                                )}
                            </div>

                            {/* Appointment history */}
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Appointment History ({selected.appointments.length})
                                </p>
                                {selected.appointments.length === 0 ? (
                                    <p className="text-sm text-gray-400">No appointments yet</p>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {selected.appointments.map(a => (
                                            <div key={a.id} className="flex items-start justify-between bg-gray-50 rounded-xl p-3 gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{a.service_type}</p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                                        <Calendar size={10} /> {a.appointment_date}
                                                        <Clock size={10} /> {a.appointment_time}
                                                    </p>
                                                    {a.notes && <p className="text-xs text-gray-400 mt-0.5 italic truncate">"{a.notes}"</p>}
                                                </div>
                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[a.status] || 'bg-gray-100 text-gray-500'}`}>
                                                        {a.status.replace('_', '-')}
                                                    </span>
                                                    {a.price != null && (
                                                        <span className="text-xs text-indigo-700 font-semibold">
                                                            {a.currency} {Number(a.price).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
