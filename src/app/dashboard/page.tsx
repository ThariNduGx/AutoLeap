'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, MessageSquare, Users, Calendar, DollarSign, Package } from 'lucide-react';

interface DashboardStats {
    businessName: string;
    userName: string;
    totalMessages: number;
    totalFAQs: number;
    telegramConnected: boolean;
    facebookConnected: boolean;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    async function fetchDashboardStats() {
        try {
            const res = await fetch('/api/dashboard/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-8"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const statCards = [
        {
            name: 'Telegram Bot',
            value: stats?.telegramConnected ? 'Connected' : 'Not Connected',
            icon: MessageSquare,
            color: stats?.telegramConnected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400',
            status: stats?.telegramConnected
        },
        {
            name: 'Facebook Page',
            value: stats?.facebookConnected ? 'Connected' : 'Not Connected',
            icon: Package,
            color: stats?.facebookConnected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400',
            status: stats?.facebookConnected
        },
        {
            name: 'Total FAQs',
            value: stats?.totalFAQs || 0,
            icon: MessageSquare,
            color: 'bg-indigo-100 text-indigo-600'
        },
        {
            name: 'AI Messages Handled',
            value: stats?.totalMessages || 0,
            icon: MessageSquare,
            color: 'bg-purple-100 text-purple-600'
        },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 mt-1">
                    Welcome back, {stats?.userName || 'there'}! Here's your {stats?.businessName || 'business'} overview.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat) => (
                    <div key={stat.name} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">{stat.name}</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Getting Started */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
                    <h2 className="text-2xl font-bold mb-4">🚀 Get Started</h2>
                    <p className="text-indigo-100 mb-6">
                        Complete these steps to activate your AI-powered customer support:
                    </p>
                    <div className="space-y-3">
                        <div className={`flex items-center gap-3 p-3 rounded-lg ${stats?.telegramConnected ? 'bg-white/20' : 'bg-white/10'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${stats?.telegramConnected ? 'bg-green-500' : 'bg-white/30'}`}>
                                {stats?.telegramConnected ? '✓' : '1'}
                            </div>
                            <span>Connect Telegram Bot</span>
                        </div>
                        <div className={`flex items-center gap-3 p-3 rounded-lg ${stats?.facebookConnected ? 'bg-white/20' : 'bg-white/10'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${stats?.facebookConnected ? 'bg-green-500' : 'bg-white/30'}`}>
                                {stats?.facebookConnected ? '✓' : '2'}
                            </div>
                            <span>Connect Facebook Page</span>
                        </div>
                        <div className={`flex items-center gap-3 p-3 rounded-lg ${(stats?.totalFAQs || 0) > 0 ? 'bg-white/20' : 'bg-white/10'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${(stats?.totalFAQs || 0) > 0 ? 'bg-green-500' : 'bg-white/30'}`}>
                                {(stats?.totalFAQs || 0) > 0 ? '✓' : '3'}
                            </div>
                            <span>Add Your First FAQ</span>
                        </div>
                    </div>
                    <a
                        href="/dashboard/settings"
                        className="mt-6 inline-block px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                        Go to Settings →
                    </a>
                </div>

                {/* Quick Stats */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Stats</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <p className="text-sm text-gray-500">Total FAQs</p>
                                <p className="text-2xl font-bold text-gray-900">{stats?.totalFAQs || 0}</p>
                            </div>
                            <div className="p-3 bg-indigo-100 rounded-lg">
                                <MessageSquare className="text-indigo-600" size={24} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <p className="text-sm text-gray-500">Messages Processed</p>
                                <p className="text-2xl font-bold text-gray-900">{stats?.totalMessages || 0}</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <MessageSquare className="text-purple-600" size={24} />
                            </div>
                        </div>
                        {(stats?.totalMessages || 0) === 0 && (
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    <strong>Tip:</strong> Once you connect your channels and add FAQs, you'll start seeing message statistics here!
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
