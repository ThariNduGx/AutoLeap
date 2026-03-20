'use client';

import { useEffect, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Users, Calendar, MessageSquare, Loader2, AlertCircle, Target, Clock } from 'lucide-react';

const INTENT_COLORS: Record<string, string> = {
    booking: '#6366f1',
    faq: '#f97316',
    cancellation: '#ef4444',
    complaint: '#dc2626',
    greeting: '#10b981',
    status: '#3b82f6',
    unknown: '#9ca3af',
};

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function AnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        fetch(`/api/analytics?days=${days}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) throw new Error(d.error);
                setData(d);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [days]);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                    <p className="text-gray-500 mt-1">Booking performance, conversation insights, and FAQ usage.</p>
                </div>
                <div className="flex gap-2">
                    {DAY_OPTIONS.map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                days === d
                                    ? 'bg-indigo-600 text-white'
                                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-24 text-gray-400">
                    <Loader2 size={24} className="animate-spin mr-2" /> Loading analytics...
                </div>
            ) : data && (
                <div className="space-y-8">
                    {/* ── KPI Row ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KPICard
                            icon={<Target size={20} />}
                            color="indigo"
                            label="Booking Success Rate"
                            value={data.bookingFunnel.successRate != null ? `${data.bookingFunnel.successRate}%` : '—'}
                            sub={`${data.bookingFunnel.successful} of ${data.bookingFunnel.totalAttempts} attempts`}
                        />
                        <KPICard
                            icon={<MessageSquare size={20} />}
                            color="purple"
                            label="Conversations"
                            value={data.conversations.total.toLocaleString()}
                            sub={`${data.conversations.escalationRate}% escalation rate`}
                        />
                        <KPICard
                            icon={<Calendar size={20} />}
                            color="green"
                            label="Appointments"
                            value={data.appointments.total.toLocaleString()}
                            sub={`${data.appointments.cancelled} cancelled, ${data.appointments.noShow} no-show`}
                        />
                        <KPICard
                            icon={<Clock size={20} />}
                            color="orange"
                            label="Avg Turns to Book"
                            value={data.bookingFunnel.avgTurnsToBook || '—'}
                            sub="AI conversation turns"
                        />
                    </div>

                    {/* ── Row 1: Booking Funnel + Intent Breakdown ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Booking Funnel */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <h2 className="text-base font-semibold text-gray-900 mb-5">Booking Funnel</h2>
                            <div className="space-y-3 mb-6">
                                <FunnelBar
                                    label="Attempts"
                                    value={data.bookingFunnel.totalAttempts}
                                    max={data.bookingFunnel.totalAttempts || 1}
                                    color="bg-indigo-200"
                                />
                                <FunnelBar
                                    label="Successful"
                                    value={data.bookingFunnel.successful}
                                    max={data.bookingFunnel.totalAttempts || 1}
                                    color="bg-green-400"
                                />
                                <FunnelBar
                                    label="Failed"
                                    value={data.bookingFunnel.failed}
                                    max={data.bookingFunnel.totalAttempts || 1}
                                    color="bg-red-300"
                                />
                            </div>

                            {data.bookingFunnel.failureReasons.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Failure Reasons</p>
                                    <div className="space-y-1">
                                        {data.bookingFunnel.failureReasons.slice(0, 5).map((r: any) => (
                                            <div key={r.reason} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600 truncate mr-2">{r.reason || 'unknown'}</span>
                                                <span className="font-medium text-gray-900 shrink-0">{r.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.bookingFunnel.byPlatform.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By Platform</p>
                                    <div className="space-y-1">
                                        {data.bookingFunnel.byPlatform.map((p: any) => (
                                            <div key={p.platform} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600 capitalize">{p.platform}</span>
                                                <span className="font-medium text-gray-900">{p.successRate}% ({p.success}/{p.attempts})</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Intent Breakdown */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <h2 className="text-base font-semibold text-gray-900 mb-5">Intent Breakdown</h2>
                            {data.conversations.intentBreakdown.length === 0 ? (
                                <EmptyState message="No conversations yet" />
                            ) : (
                                <>
                                    <div className="h-48 mb-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={data.conversations.intentBreakdown}
                                                    dataKey="count"
                                                    nameKey="intent"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                >
                                                    {data.conversations.intentBreakdown.map((entry: any) => (
                                                        <Cell
                                                            key={entry.intent}
                                                            fill={INTENT_COLORS[entry.intent] || '#9ca3af'}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v: any, n: any) => [v, n]} />
                                                <Legend formatter={(value) => value} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="p-2 bg-orange-50 rounded-lg text-center">
                                            <p className="text-orange-700 font-semibold">{data.conversations.escalated}</p>
                                            <p className="text-gray-500 text-xs">Escalated</p>
                                        </div>
                                        <div className="p-2 bg-blue-50 rounded-lg text-center">
                                            <p className="text-blue-700 font-semibold">{data.conversations.humanTakeover}</p>
                                            <p className="text-gray-500 text-xs">Human Takeover</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Row 2: Daily Bookings + Peak Hours ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Daily Bookings Trend */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <h2 className="text-base font-semibold text-gray-900 mb-5">Daily Bookings</h2>
                            {data.appointments.dailyBookings.length === 0 ? (
                                <EmptyState message="No appointment data" />
                            ) : (
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.appointments.dailyBookings} barSize={8}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={v => v.slice(5)}
                                            />
                                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="scheduled" name="Scheduled" fill="#6366f1" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="cancelled" name="Cancelled" fill="#f87171" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="completed" name="Completed" fill="#34d399" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* Peak Booking Hours */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <h2 className="text-base font-semibold text-gray-900 mb-5">Peak Booking Hours</h2>
                            {data.appointments.total === 0 ? (
                                <EmptyState message="No appointment data" />
                            ) : (
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={data.appointments.peakHours.filter((h: any) => h.count > 0)}
                                            barSize={14}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                formatter={(v: any) => [v, 'Appointments']}
                                            />
                                            <Bar dataKey="count" name="Appointments" fill="#f97316" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Top FAQs ── */}
                    {data.topFAQs.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
                                <TrendingUp size={18} className="text-indigo-500" />
                                Most-Used FAQs
                            </h2>
                            <div className="space-y-3">
                                {data.topFAQs.map((faq: any, i: number) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-900 truncate">{faq.question}</p>
                                            <p className="text-xs text-gray-400 capitalize">{faq.category || 'general'}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full">
                                                <Users size={10} /> {faq.hit_count}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function KPICard({ icon, color, label, value, sub }: {
    icon: React.ReactNode;
    color: 'indigo' | 'purple' | 'green' | 'orange';
    label: string;
    value: string | number;
    sub: string;
}) {
    const colorMap = {
        indigo: 'bg-indigo-100 text-indigo-600',
        purple: 'bg-purple-100 text-purple-600',
        green: 'bg-green-100 text-green-600',
        orange: 'bg-orange-100 text-orange-600',
    };
    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className={`inline-flex p-2.5 rounded-xl ${colorMap[color]} mb-3`}>{icon}</div>
            <p className="text-gray-500 text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </div>
    );
}

function FunnelBar({ label, value, max, color }: {
    label: string; value: number; max: number; color: string;
}) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{label}</span>
                <span className="font-semibold text-gray-900">{value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">{message}</div>
    );
}
