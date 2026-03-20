'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Phone, CheckCircle, XCircle, Loader2, RefreshCw, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface Booking {
    id: string;
    customer_name: string;
    customer_phone: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
    status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
    platform?: string;
}

const TABS = [
    { label: 'All', value: 'All' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'No-show', value: 'no_show' },
] as const;

const PAGE_SIZE = 20;

export default function BookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('All');
    const [page, setPage] = useState(0);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [cancelError, setCancelError] = useState('');
    const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

    const fetchBookings = useCallback(async () => {
        try {
            const res = await fetch('/api/bookings');
            const data = await res.json();
            if (Array.isArray(data)) setBookings(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    // Reset to page 0 when filter changes
    useEffect(() => {
        setPage(0);
    }, [filter]);

    const filtered = filter === 'All'
        ? bookings
        : bookings.filter(b => b.status === filter);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    async function handleCancel(id: string) {
        setCancelling(id);
        setCancelError('');
        try {
            const res = await fetch(`/api/bookings/${id}/cancel`, { method: 'POST' });
            if (res.ok) {
                setConfirmCancel(null);
                await fetchBookings();
            } else {
                const data = await res.json();
                setCancelError(data.error || 'Failed to cancel');
            }
        } finally {
            setCancelling(null);
        }
    }

    const statusBadge = (status: string) => {
        switch (status) {
            case 'scheduled':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                        <CheckCircle size={12} /> Scheduled
                    </span>
                );
            case 'completed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        <CheckCircle size={12} /> Completed
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                        <XCircle size={12} /> Cancelled
                    </span>
                );
            case 'no_show':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        <AlertCircle size={12} /> No-show
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {status}
                    </span>
                );
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
                    <p className="text-gray-500 mt-1">
                        {bookings.length} total appointment{bookings.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={fetchBookings}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {TABS.map((tab) => {
                    const count = tab.value === 'All'
                        ? bookings.length
                        : bookings.filter(b => b.status === tab.value).length;
                    return (
                        <button
                            key={tab.value}
                            onClick={() => setFilter(tab.value)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                                filter === tab.value
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                filter === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {cancelError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {cancelError}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin" /> Loading bookings...
                    </div>
                ) : paginated.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No {filter !== 'All' ? filter : ''} bookings found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginated.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                                                    {(booking.customer_name || 'U')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{booking.customer_name || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                        <Phone size={10} /> {booking.customer_phone || '—'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-700">{booking.service_type || 'General'}</span>
                                            {booking.platform && (
                                                <p className="text-xs text-gray-400 mt-0.5 capitalize">{booking.platform}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm text-gray-900 flex items-center gap-1.5">
                                                    <Calendar size={13} className="text-gray-400" />
                                                    {booking.appointment_date ?? '—'}
                                                </span>
                                                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                                    <Clock size={13} className="text-gray-400" />
                                                    {booking.appointment_time ?? '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {statusBadge(booking.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {booking.status === 'scheduled' && (
                                                confirmCancel === booking.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-600">Sure?</span>
                                                        <button
                                                            onClick={() => handleCancel(booking.id)}
                                                            disabled={cancelling === booking.id}
                                                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg flex items-center gap-1 disabled:opacity-50"
                                                        >
                                                            {cancelling === booking.id ? <Loader2 size={10} className="animate-spin" /> : null}
                                                            Yes, Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmCancel(null)}
                                                            className="px-2.5 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                                                        >
                                                            Keep
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setConfirmCancel(booking.id); setCancelError(''); }}
                                                        className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                    >
                                                        Cancel
                                                    </button>
                                                )
                                            )}
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
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
