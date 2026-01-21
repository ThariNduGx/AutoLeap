'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Building2,
    BarChart2,
    Settings,
    Menu,
    X,
    LogOut,
} from 'lucide-react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const navigation = [
        { name: 'Overview', href: '/admin', icon: LayoutDashboard },
        { name: 'Businesses', href: '/admin/businesses', icon: Building2 },
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart2 },
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/auth/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
                <div className="p-6 flex items-center gap-3 border-b border-gray-100">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">A</span>
                    </div>
                    <div>
                        <span className="text-xl font-bold text-gray-900 tracking-tight">AutoLeap</span>
                        <p className="text-xs text-red-600 font-medium">Admin Panel</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1 mt-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-red-50 text-red-700'
                                    : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <item.icon size={20} className={isActive ? 'text-red-600' : 'text-gray-400'} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        <LogOut size={20} className="text-gray-400" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-10 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">A</span>
                    </div>
                    <div>
                        <span className="font-bold text-gray-900">AutoLeap</span>
                        <p className="text-xs text-red-600">Admin</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 text-gray-600"
                >
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Drawer */}
            {isSidebarOpen && (
                <div className="md:hidden fixed inset-0 z-20 bg-gray-800/50" onClick={() => setIsSidebarOpen(false)}>
                    <div className="w-64 h-full bg-white p-4" onClick={(e) => e.stopPropagation()}>
                        <nav className="space-y-1 mt-12">
                            {navigation.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${pathname === item.href
                                        ? 'bg-red-50 text-red-700'
                                        : 'text-gray-700'
                                        }`}
                                >
                                    <item.icon size={20} />
                                    {item.name}
                                </Link>
                            ))}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-700 mt-4"
                            >
                                <LogOut size={20} />
                                Logout
                            </button>
                        </nav>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 pt-16 md:pt-0 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
