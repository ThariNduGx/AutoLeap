'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Phone, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function BookingsPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        async function fetchBookings() {
            try {
                const res = await fetch('/api/bookings');
                const data = await res.json();
                if (Array.isArray(data)) setBookings(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchBookings();
    }, []);

    const filteredBookings = filter === 'All'
        ? bookings
        : bookings.filter(b => b.status === filter.toLowerCase());

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
                    <p className="text-gray-500 mt-1">Manage your upcoming appointments.</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {['All', 'confirmed', 'pending', 'cancelled'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap capitalize ${filter === tab ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading bookings...</div>
                ) : filteredBookings.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No bookings found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredBookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                                    {(booking.customer_name || 'U')[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{booking.customer_name || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                        <Phone size={10} /> {booking.customer_phone || '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-700">{booking.service_type || 'General'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm text-gray-900 flex items-center gap-1.5">
                                                    <Calendar size={14} className="text-gray-400" />
                                                    {booking.start_time ? format(new Date(booking.start_time), 'yyyy-MM-dd') : '-'}
                                                </span>
                                                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-gray-400" />
                                                    {booking.start_time ? format(new Date(booking.start_time), 'HH:mm') : '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {booking.status === 'confirmed' && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                                    <CheckCircle size={12} /> Confirmed
                                                </span>
                                            )}
                                            {booking.status === 'pending' && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
                                                    <Clock size={12} /> Pending
                                                </span>
                                            )}
                                            {booking.status === 'cancelled' && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                                    <XCircle size={12} /> Cancelled
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
