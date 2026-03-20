'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Calendar, TrendingUp, CheckCircle2, XCircle, RefreshCw, Target } from 'lucide-react';

interface DashboardStats {
    businessName: string;
    userName: string;
    totalMessages: number;
    totalFAQs: number;
    telegramConnected: boolean;
    facebookConnected: boolean;
    todayAppointments: number;
    bookingCompletionRate: number | null;
    bookingAttempts: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const fetchDashboardStats = useCallback(async () => {
        try {
            const res = await fetch('/api/dashboard/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
                setLastRefreshed(new Date());
            }
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardStats();
        // Auto-refresh every 30 seconds
        const timer = setInterval(fetchDashboardStats, 30_000);
        return () => clearInterval(timer);
    }, [fetchDashboardStats]);

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-8" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const completionRate = stats?.bookingCompletionRate;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 mt-1">
                        Welcome back, {stats?.userName || 'there'}! Here&apos;s your{' '}
                        <span className="font-medium text-gray-700">{stats?.businessName || 'business'}</span> overview.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <RefreshCw size={12} />
                    {lastRefreshed
                        ? `Refreshed ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                        : 'Refreshing...'}
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* AI Messages Handled */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
                            <MessageSquare size={22} />
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">AI Messages Handled</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                        {(stats?.totalMessages || 0).toLocaleString()}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">All time</p>
                </div>

                {/* Today's Appointments */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-green-100 text-green-600">
                            <Calendar size={22} />
                        </div>
                        {(stats?.todayAppointments || 0) > 0 && (
                            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                Today
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Today&apos;s Appointments</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                        {stats?.todayAppointments || 0}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">Scheduled today</p>
                </div>

                {/* Booking Completion Rate */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600">
                            <Target size={22} />
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Booking Success Rate</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                        {completionRate !== null ? `${completionRate}%` : '—'}
                    </h3>
                    {stats?.bookingAttempts ? (
                        <p className="text-xs text-gray-400 mt-1">
                            {stats.bookingAttempts} attempt{stats.bookingAttempts !== 1 ? 's' : ''} in 30 days
                        </p>
                    ) : (
                        <p className="text-xs text-gray-400 mt-1">No bookings yet</p>
                    )}
                    {/* Progress bar */}
                    {completionRate !== null && (
                        <div className="mt-3 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    completionRate >= 80 ? 'bg-green-500' :
                                    completionRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${completionRate}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Total FAQs */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
                            <TrendingUp size={22} />
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Knowledge Base</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                        {stats?.totalFAQs || 0}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">FAQs in database</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Getting Started */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
                    <h2 className="text-2xl font-bold mb-4">🚀 Get Started</h2>
                    <p className="text-indigo-100 mb-6">
                        Complete these steps to activate your AI-powered customer support:
                    </p>
                    <div className="space-y-3">
                        <SetupStep
                            done={!!stats?.telegramConnected}
                            step={1}
                            label="Connect Telegram Bot"
                        />
                        <SetupStep
                            done={!!stats?.facebookConnected}
                            step={2}
                            label="Connect Facebook Page"
                        />
                        <SetupStep
                            done={(stats?.totalFAQs || 0) > 0}
                            step={3}
                            label="Add Your First FAQ"
                        />
                    </div>
                    <a
                        href="/dashboard/settings"
                        className="mt-6 inline-block px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                        Go to Settings →
                    </a>
                </div>

                {/* Channel Status */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Channel Status</h2>
                    <div className="space-y-4">
                        <ChannelRow
                            label="Telegram Bot"
                            connected={!!stats?.telegramConnected}
                            description={stats?.telegramConnected
                                ? 'Receiving and responding to messages'
                                : 'Connect in Settings to enable Telegram support'}
                        />
                        <ChannelRow
                            label="Facebook Messenger"
                            connected={!!stats?.facebookConnected}
                            description={stats?.facebookConnected
                                ? 'Receiving and responding to messages'
                                : 'Connect in Settings to enable Messenger support'}
                        />
                        {(stats?.totalMessages || 0) === 0 && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    <strong>Tip:</strong> Once you connect your channels and add FAQs, your AI assistant starts responding automatically.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SetupStep({ done, step, label }: { done: boolean; step: number; label: string }) {
    return (
        <div className={`flex items-center gap-3 p-3 rounded-lg ${done ? 'bg-white/20' : 'bg-white/10'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? 'bg-green-500' : 'bg-white/30'}`}>
                {done ? '✓' : step}
            </div>
            <span className={done ? 'line-through opacity-70' : ''}>{label}</span>
        </div>
    );
}

function ChannelRow({ label, connected, description }: { label: string; connected: boolean; description: string }) {
    return (
        <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl gap-3">
            <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                connected ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
            }`}>
                {connected
                    ? <><CheckCircle2 size={12} /> Connected</>
                    : <><XCircle size={12} /> Not set up</>
                }
            </div>
        </div>
    );
}
