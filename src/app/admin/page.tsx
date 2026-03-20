'use client';

import { ArrowUpRight, Building2, MessageSquare, Zap, Activity, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface NearBudgetBusiness {
    name: string;
    usedUsd: number;
    limitUsd: number;
    pct: number;
}

interface AdminStats {
    totalBusinesses: number;
    telegramConnections: number;
    facebookConnections: number;
    messages: { completed: number; failed: number; pending: number };
    totalCostUsd: number;
    recentBusinesses: { name: string; createdAt: string }[];
    nearBudgetBusinesses: NearBudgetBusiness[];
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();
            if (data.success) {
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    }

    const statCards = [
        {
            name: 'Total Businesses',
            value: stats?.totalBusinesses ?? '—',
            icon: Building2,
            color: 'bg-blue-100 text-blue-600',
        },
        {
            name: 'Telegram Bots',
            value: stats?.telegramConnections ?? '—',
            icon: MessageSquare,
            color: 'bg-indigo-100 text-indigo-600',
        },
        {
            name: 'Facebook Pages',
            value: stats?.facebookConnections ?? '—',
            icon: Zap,
            color: 'bg-purple-100 text-purple-600',
        },
        {
            name: 'Messages Processed',
            value: stats ? stats.messages.completed.toLocaleString() : '—',
            icon: Activity,
            color: 'bg-green-100 text-green-600',
        },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-500 mt-1">Platform overview and statistics</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat) => (
                    <div key={stat.name} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                            {stats && (
                                <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                    Live <ArrowUpRight size={12} className="ml-1" />
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 text-sm font-medium">{stat.name}</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">
                            {loading ? (
                                <span className="inline-block w-12 h-7 bg-gray-200 rounded animate-pulse" />
                            ) : (
                                stat.value
                            )}
                        </h3>
                    </div>
                ))}
            </div>

            {/* Budget Alerts */}
            {!loading && stats && stats.nearBudgetBusinesses.length > 0 && (
                <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle size={18} className="text-amber-600" />
                        <h2 className="text-base font-semibold text-amber-800">
                            Budget Alerts ({stats.nearBudgetBusinesses.length})
                        </h2>
                        <span className="text-xs text-amber-600 ml-auto">≥ 80% of monthly limit used</span>
                    </div>
                    <div className="space-y-3">
                        {stats.nearBudgetBusinesses.map((b, i) => (
                            <div key={i} className="bg-white rounded-xl p-4 border border-amber-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-900">{b.name}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.pct >= 100 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {b.pct}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full ${b.pct >= 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                                        style={{ width: `${Math.min(100, b.pct)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    ${b.usedUsd.toFixed(4)} used of ${b.limitUsd.toFixed(2)} limit
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Activity */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h2>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : stats && stats.recentBusinesses.length > 0 ? (
                        <div className="space-y-4">
                            {stats.recentBusinesses.map((biz, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">New business onboarded</p>
                                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                                            {biz.name} • {formatDistanceToNow(new Date(biz.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-6">No businesses registered yet</p>
                    )}
                </div>

                {/* Platform Summary */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Platform Summary</h2>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Messages Completed</span>
                            <span className="text-sm font-semibold text-green-600">
                                {loading ? '—' : stats?.messages.completed.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Messages Failed</span>
                            <span className="text-sm font-semibold text-red-500">
                                {loading ? '—' : stats?.messages.failed.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Messages Pending</span>
                            <span className="text-sm font-semibold text-yellow-600">
                                {loading ? '—' : stats?.messages.pending.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-3">
                            <span className="text-sm text-gray-600">Total Platform Cost</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {loading ? '—' : `$${stats?.totalCostUsd.toFixed(4)}`}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
