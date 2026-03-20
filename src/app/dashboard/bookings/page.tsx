'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Calendar, Clock, Phone, CheckCircle, XCircle, Loader2, RefreshCw,
    ChevronLeft, ChevronRight, AlertCircle, Download, UserX, CheckSquare, Square,
} from 'lucide-react';

interface Booking {
    id: string;
    customer_name: string;
    customer_phone: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
    status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
    platform?: string;
    notes?: string;
    price?: number;
    currency?: string;
}

const TABS = [
    { label: 'All',       value: 'All' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'No-show',   value: 'no_show' },
] as const;

const PAGE_SIZE = 20;
const today = new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

export default function BookingsPage() {
    const [bookings, setBookings]       = useState<Booking[]>([]);
    const [loading, setLoading]         = useState(true);
    const [filter, setFilter]           = useState<string>('All');
    const [page, setPage]               = useState(0);
    const [cancelling, setCancelling]   = useState<string | null>(null);
    const [cancelError, setCancelError] = useState('');
    const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

    // Bulk selection
    const [selected, setSelected]   = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState('');
    const [bulking, setBulking]       = useState(false);

    // CSV export
    const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
    const [dateTo, setDateTo]     = useState(today);
    const [showExport, setShowExport] = useState(false);
    const [exporting, setExporting]   = useState(false);

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        setSelected(new Set());
        try {
            const res = await fetch('/api/bookings');
            const data = await res.json();
            if (Array.isArray(data)) setBookings(data);
        } catch { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchBookings(); }, [fetchBookings]);
    useEffect(() => { setPage(0); setSelected(new Set()); }, [filter]);

    const filtered  = filter === 'All' ? bookings : bookings.filter(b => b.status === filter);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const today_str = new Date().toISOString().slice(0, 10);
    const isPast = (b: Booking) => b.appointment_date < today_str;

    // ── Actions ───────────────────────────────────────────────────────────────
    async function handleCancel(id: string) {
        setCancelling(id); setCancelError('');
        try {
            const res = await fetch(`/api/bookings/${id}/cancel`, { method: 'POST' });
            if (res.ok) { setConfirmCancel(null); await fetchBookings(); }
            else { const d = await res.json(); setCancelError(d.error || 'Failed to cancel'); }
        } finally { setCancelling(null); }
    }

    async function handleBulk() {
        if (!selected.size || !bulkAction) return;
        setBulking(true);
        try {
            await fetch('/api/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [...selected], status: bulkAction }),
            });
            setBulkAction('');
            await fetchBookings();
        } finally { setBulking(false); }
    }

    async function handleExport() {
        setExporting(true);
        try {
            const url = `/api/bookings?format=csv&date_from=${dateFrom}&date_to=${dateTo}`;
            const res = await fetch(url);
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `bookings_${dateFrom}_to_${dateTo}.csv`;
            link.click();
            setShowExport(false);
        } finally { setExporting(false); }
    }

    // ── Toggle selection ──────────────────────────────────────────────────────
    function toggleSelect(id: string) {
        setSelected(s => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    }
    function selectAll() {
        if (selected.size === paginated.length) setSelected(new Set());
        else setSelected(new Set(paginated.map(b => b.id)));
    }

    // ── Render helpers ────────────────────────────────────────────────────────
    function statusBadge(status: string) {
        const map: Record<string, string> = {
            scheduled: 'bg-green-50 text-green-700 border-green-100',
            completed: 'bg-blue-50 text-blue-700 border-blue-100',
            cancelled: 'bg-red-50 text-red-700 border-red-100',
            no_show:   'bg-gray-100 text-gray-600 border-gray-200',
        };
        const icons: Record<string, React.ReactNode> = {
            scheduled: <CheckCircle size={11} />,
            completed: <CheckCircle size={11} />,
            cancelled: <XCircle size={11} />,
            no_show:   <AlertCircle size={11} />,
        };
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] || 'bg-gray-100 text-gray-600'}`}>
                {icons[status]} {status.replace('_', '-')}
            </span>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
                    <p className="text-gray-500 text-sm mt-0.5">{bookings.length} total appointment{bookings.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowExport(!showExport)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <Download size={14} /> Export CSV
                    </button>
                    <button onClick={fetchBookings} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            {/* CSV export panel */}
            {showExport && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-end gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <button onClick={handleExport} disabled={exporting}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                        {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        Download
                    </button>
                </div>
            )}

            {/* Bulk action bar */}
            {selected.size > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center gap-3">
                    <span className="text-sm font-medium text-indigo-700">{selected.size} selected</span>
                    <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                        className="px-3 py-1.5 border border-indigo-300 rounded-lg text-sm bg-white outline-none">
                        <option value="">Choose action…</option>
                        <option value="completed">Mark as Completed</option>
                        <option value="no_show">Mark as No-show</option>
                    </select>
                    <button onClick={handleBulk} disabled={!bulkAction || bulking}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg disabled:opacity-50 hover:bg-indigo-700 flex items-center gap-2">
                        {bulking ? <Loader2 size={13} className="animate-spin" /> : null}
                        Apply
                    </button>
                    <button onClick={() => setSelected(new Set())} className="text-xs text-indigo-600 hover:underline ml-auto">
                        Clear
                    </button>
                </div>
            )}

            {/* Status tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {TABS.map(tab => {
                    const count = tab.value === 'All' ? bookings.length : bookings.filter(b => b.status === tab.value).length;
                    return (
                        <button key={tab.value} onClick={() => setFilter(tab.value)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${filter === tab.value ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                            {tab.label}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {cancelError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={14} /> {cancelError}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center flex justify-center gap-2 text-gray-400">
                        <Loader2 size={18} className="animate-spin" /> Loading…
                    </div>
                ) : paginated.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No {filter !== 'All' ? filter.replace('_', '-') : ''} bookings found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3">
                                        <button onClick={selectAll} className="text-gray-400 hover:text-gray-600">
                                            {selected.size === paginated.length && paginated.length > 0
                                                ? <CheckSquare size={15} className="text-indigo-600" />
                                                : <Square size={15} />}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginated.map(booking => (
                                    <tr key={booking.id} className={`transition-colors ${selected.has(booking.id) ? 'bg-indigo-50' : 'hover:bg-gray-50/50'}`}>
                                        <td className="px-4 py-3">
                                            <button onClick={() => toggleSelect(booking.id)} className="text-gray-400 hover:text-indigo-600">
                                                {selected.has(booking.id)
                                                    ? <CheckSquare size={15} className="text-indigo-600" />
                                                    : <Square size={15} />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                                                    {(booking.customer_name || 'U')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{booking.customer_name || '—'}</p>
                                                    <p className="text-xs text-gray-400 flex items-center gap-1">
                                                        <Phone size={10} /> {booking.customer_phone || '—'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-gray-800">{booking.service_type || 'General'}</p>
                                            {booking.notes && (
                                                <p className="text-xs text-gray-400 mt-0.5 italic max-w-[160px] truncate">"{booking.notes}"</p>
                                            )}
                                            {booking.platform && <p className="text-xs text-gray-400 capitalize">{booking.platform}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-gray-900 flex items-center gap-1">
                                                <Calendar size={12} className="text-gray-400" /> {booking.appointment_date}
                                            </p>
                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                <Clock size={11} className="text-gray-400" /> {booking.appointment_time}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            {booking.price != null
                                                ? <span className="text-sm font-semibold text-indigo-700">{booking.currency} {Number(booking.price).toLocaleString()}</span>
                                                : <span className="text-xs text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3">{statusBadge(booking.status)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                {/* Cancel (scheduled only) */}
                                                {booking.status === 'scheduled' && (
                                                    confirmCancel === booking.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => handleCancel(booking.id)} disabled={cancelling === booking.id}
                                                                className="px-2 py-1 bg-red-600 text-white text-xs rounded-lg disabled:opacity-50 flex items-center gap-1">
                                                                {cancelling === booking.id && <Loader2 size={10} className="animate-spin" />} Yes
                                                            </button>
                                                            <button onClick={() => setConfirmCancel(null)} className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg">No</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => { setConfirmCancel(booking.id); setCancelError(''); }}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cancel">
                                                            <XCircle size={14} />
                                                        </button>
                                                    )
                                                )}
                                                {/* No-show (scheduled + past) */}
                                                {booking.status === 'scheduled' && isPast(booking) && (
                                                    <button
                                                        onClick={() => {
                                                            setSelected(new Set([booking.id]));
                                                            setBulkAction('no_show');
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                        title="Mark as no-show"
                                                    >
                                                        <UserX size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-500">
                        Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                            <ChevronLeft size={16} />
                        </button>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
