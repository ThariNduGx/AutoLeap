'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    MessageSquare,
    Calendar,
    Settings,
    BarChart2,
    Menu,
    X,
    CreditCard,
    LogOut,
    TrendingUp,
    Briefcase,
    Users,
} from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const [businessName, setBusinessName] = useState('Loading...');
    const [userName, setUserName] = useState('');

    useEffect(() => {
        fetchBusinessInfo();
    }, []);

    async function fetchBusinessInfo() {
        try {
            const res = await fetch('/api/dashboard/stats');
            if (res.ok) {
                const data = await res.json();
                setBusinessName(data.businessName);
                setUserName(data.userName);
            }
        } catch (error) {
            console.error('Failed to fetch business info:', error);
            setBusinessName('Your Business');
        }
    }

    const navigation = [
        { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Conversations', href: '/dashboard/conversations', icon: MessageSquare },
        { name: 'Bookings', href: '/dashboard/bookings', icon: Calendar },
        { name: 'Services', href: '/dashboard/services', icon: Briefcase },
        { name: 'Waitlist', href: '/dashboard/waitlist', icon: Users },
        { name: 'Analytics', href: '/dashboard/analytics', icon: TrendingUp },
        { name: 'FAQs', href: '/dashboard/faqs', icon: BarChart2 },
        { name: 'Cost Center', href: '/dashboard/costs', icon: CreditCard },
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/auth/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">A</span>
                    </div>
                    <span className="text-xl font-bold text-gray-900 tracking-tight">AutoLeap</span>
                </div>

                <nav className="flex-1 px-4 space-y-1 mt-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <item.icon size={20} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-indigo-600 font-semibold text-sm">
                                {businessName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{businessName}</p>
                            <p className="text-xs text-gray-500 truncate">{userName}</p>
                        </div>
                    </div>
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
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">A</span>
                    </div>
                    <span className="font-bold text-gray-900">AutoLeap</span>
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
                                        ? 'bg-indigo-50 text-indigo-700'
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
