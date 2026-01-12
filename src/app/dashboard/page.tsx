'use client';

import { ArrowUpRight, MessageSquare, Users, Calendar, DollarSign } from 'lucide-react';

export default function DashboardOverview() {
    const stats = [
        { name: 'Total Revenue', value: 'Rs. 45,000', change: '+12%', icon: DollarSign, color: 'bg-green-100 text-green-600' },
        { name: 'Total Bookings', value: '24', change: '+18%', icon: Calendar, color: 'bg-indigo-100 text-indigo-600' },
        { name: 'Active Customers', value: '156', change: '+5%', icon: Users, color: 'bg-orange-100 text-orange-600' },
        { name: 'AI Messages', value: '1,245', change: '+24%', icon: MessageSquare, color: 'bg-blue-100 text-blue-600' },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 mt-1">Welcome back, Raj! Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.map((stat) => (
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Bookings */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
                        <button className="text-sm font-medium text-indigo-600 hover:underline">View all</button>
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700">
                                        KP
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">Kamal Perera</h4>
                                        <p className="text-xs text-gray-500">AC Service • Today, 2:00 PM</p>
                                    </div>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Confirmed</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Activity Feed</h2>
                    <div className="space-y-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                    <div className="w-2 h-2 rounded-full bg-gray-300 mt-2" />
                                    <div className="w-0.5 h-full bg-gray-100 mt-1" />
                                </div>
                                <div className="pb-2">
                                    <p className="text-sm text-gray-900">AI handled "Pricing Inquiry" from <span className="font-medium">0771234567</span></p>
                                    <p className="text-xs text-gray-500 mt-1">2 mins ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
