'use client';

import { useEffect, useState } from 'react';
import { Activity, DollarSign, CheckCircle2, XCircle, MessageSquare, Facebook, Loader2 } from 'lucide-react';

interface PlatformStats {
    messages: { completed: number; failed: number; pending: number };
    totalCostUsd: number;
}

interface BusinessRow {
    id: string;
    name: string;
    owner: { name: string; email: string } | null;
    integrations: { telegram: boolean; facebook: boolean };
    faqCount: number;
    messageCount: number;
    createdAt: string;
}

export default function AdminAnalyticsPage() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/stats').then(r => r.json()),
            fetch('/api/admin/businesses').then(r => r.json()),
        ]).then(([statsData, bizData]) => {
            if (statsData.success) setStats(statsData);
            if (bizData.success) setBusinesses(bizData.businesses || []);
        }).catch(err => {
            console.error('Analytics fetch error:', err);
        }).finally(() => setLoading(false));
    }, []);

    const totalMessages = stats
        ? stats.messages.completed + stats.messages.failed + stats.messages.pending
        : 0;

    const successRate = totalMessages > 0
        ? Math.round((stats!.messages.completed / totalMessages) * 100)
        : 0;

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-gray-400" size={40} />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                <p className="text-gray-500 mt-1">Platform usage and performance overview</p>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-green-100 text-green-600">
                            <Activity size={22} />
                        </div>
                        <p className="text-sm font-medium text-gray-500">Total Messages Processed</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                        {stats?.messages.completed.toLocaleString() ?? '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {stats?.messages.failed ?? 0} failed · {stats?.messages.pending ?? 0} pending
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-yellow-100 text-yellow-600">
                            <DollarSign size={22} />
                        </div>
                        <p className="text-sm font-medium text-gray-500">Platform AI Cost (USD)</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                        ${stats?.totalCostUsd.toFixed(4) ?? '0.0000'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Across all businesses</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                            <CheckCircle2 size={22} />
                        </div>
                        <p className="text-sm font-medium text-gray-500">Success Rate</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                        {totalMessages > 0 ? `${successRate}%` : '—'}
                    </p>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${successRate}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Per-Business Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Per-Business Usage</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Messages</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FAQs</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channels</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {businesses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No businesses registered yet
                                    </td>
                                </tr>
                            ) : (
                                businesses
                                    .sort((a, b) => b.messageCount - a.messageCount)
                                    .map((biz) => (
                                        <tr key={biz.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <p className="font-medium text-gray-900">{biz.name}</p>
                                                <p className="text-xs text-gray-400">{biz.id.substring(0, 8)}…</p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {biz.owner ? (
                                                    <div>
                                                        <p className="text-sm text-gray-900">{biz.owner.name}</p>
                                                        <p className="text-xs text-gray-400">{biz.owner.email}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {biz.messageCount.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                                    {biz.faqCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                        biz.integrations.telegram
                                                            ? 'bg-indigo-50 text-indigo-700'
                                                            : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        <MessageSquare size={11} />
                                                        {biz.integrations.telegram
                                                            ? <CheckCircle2 size={11} />
                                                            : <XCircle size={11} />
                                                        }
                                                    </span>
                                                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                        biz.integrations.facebook
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        <Facebook size={11} />
                                                        {biz.integrations.facebook
                                                            ? <CheckCircle2 size={11} />
                                                            : <XCircle size={11} />
                                                        }
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
