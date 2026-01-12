'use client';

import { Suspense, useEffect, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import { TrendingDown, TrendingUp, DollarSign, Activity, Zap } from 'lucide-react';

function DashboardContent() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/costs?days=30');
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error('Failed to load data', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="animate-pulse text-indigo-600 font-medium">Loading Dashboard...</div>
            </div>
        );
    }

    if (!data) return <div>Error loading data</div>;

    const { summary, daily } = data;

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Cost Optimization Dashboard</h1>
                    <p className="text-gray-500 mt-2">Real-time tracking of AI spend and efficiency</p>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {/* Total Cost */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <DollarSign size={24} />
                            </div>
                            <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                On Track
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm">30-Day Spend</p>
                        <h3 className="text-2xl font-bold text-gray-900">${summary.totalCost.toFixed(4)}</h3>
                    </div>

                    {/* Projected */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                <TrendingUp size={24} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm">Projected Monthly</p>
                        <h3 className="text-2xl font-bold text-gray-900">${summary.projectedMonthly.toFixed(2)}</h3>
                        <p className="text-xs text-gray-400 mt-1">Limit: $15.00</p>
                    </div>

                    {/* Cache Hit Rate */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                                <Zap size={24} />
                            </div>
                            <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                Target: 60%
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm">Cache Hit Rate</p>
                        <h3 className="text-2xl font-bold text-gray-900">{(summary.cacheHitRate * 100).toFixed(1)}%</h3>
                    </div>

                    {/* Avg Cost Per Query */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                <Activity size={24} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm">Avg Cost / Query</p>
                        <h3 className="text-2xl font-bold text-gray-900">${summary.avgCostPerQuery.toFixed(5)}</h3>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Daily Cost Chart */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Cost Trend</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={daily}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [`$${Number(value).toFixed(4)}`, 'Cost']}
                                    />
                                    <Bar dataKey="total_cost" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Efficiency Chart */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">Efficiency (Cache Hits vs API)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={daily}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend />
                                    <Bar dataKey="query_count" name="Total Queries" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="cache_hits" name="Cache Hits" fill="#f97316" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
