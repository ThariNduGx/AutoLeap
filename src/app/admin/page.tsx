'use client';

import { ArrowUpRight, Building2, MessageSquare, Zap, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalBusinesses: 0,
        telegramConnections: 0,
        facebookConnections: 0,
        totalMessages: 0,
    });

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const res = await fetch('/api/admin/businesses');
            const data = await res.json();

            if (data.success) {
                const businesses = data.businesses || [];
                setStats({
                    totalBusinesses: businesses.length,
                    telegramConnections: businesses.filter((b: any) => b.integrations.telegram).length,
                    facebookConnections: businesses.filter((b: any) => b.integrations.facebook).length,
                    totalMessages: 1245, // TODO: Get from actual data
                });
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    const statCards = [
        { name: 'Total Businesses', value: stats.totalBusinesses, change: '+12%', icon: Building2, color: 'bg-blue-100 text-blue-600' },
        { name: 'Telegram Bots', value: stats.telegramConnections, change: '+8%', icon: MessageSquare, color: 'bg-indigo-100 text-indigo-600' },
        { name: 'Facebook Pages', value: stats.facebookConnections, change: '+24%', icon: Zap, color: 'bg-purple-100 text-purple-600' },
        { name: 'Messages Processed', value: stats.totalMessages.toLocaleString(), change: '+18%', icon: Activity, color: 'bg-green-100 text-green-600' },
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
                            <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                {stat.change} <ArrowUpRight size={12} className="ml-1" />
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">{stat.name}</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Activity */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h2>
                    <div className="space-y-4">
                        {[
                            { action: 'New business onboarded', business: 'AC Services Co', time: '2 mins ago' },
                            { action: 'Facebook page connected', business: 'Clean & Shine', time: '15 mins ago' },
                            { action: 'Telegram bot activated', business: 'Pet Grooming Pro', time: '1 hour ago' },
                        ].map((activity, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{activity.business} • {activity.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
                    <div className="space-y-3">
                        <button className="w-full text-left p-4 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100">
                            <h3 className="font-medium text-gray-900 mb-1">View All Businesses</h3>
                            <p className="text-sm text-gray-500">Manage and monitor business accounts</p>
                        </button>
                        <button className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100">
                            <h3 className="font-medium text-gray-900 mb-1">System Settings</h3>
                            <p className="text-sm text-gray-500">Configure platform settings</p>
                        </button>
                        <button className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100">
                            <h3 className="font-medium text-gray-900 mb-1">View Analytics</h3>
                            <p className="text-sm text-gray-500">Detailed platform analytics</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
