'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, XCircle, MessageSquare, Facebook, Calendar, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Business {
    id: string;
    name: string;
    owner: {
        email: string;
        name: string;
    } | null;
    integrations: {
        telegram: boolean;
        facebook: boolean;
    };
    facebookPageName: string | null;
    faqCount: number;
    createdAt: string;
}

export default function BusinessesPage() {
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchBusinesses();
    }, []);

    async function fetchBusinesses() {
        try {
            const res = await fetch('/api/admin/businesses');
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to fetch businesses');
                return;
            }

            setBusinesses(data.businesses || []);
        } catch (err) {
            setError('Failed to load businesses');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-gray-400" size={40} />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <p className="text-red-700 font-medium">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
                <p className="text-gray-500 mt-1">Manage all onboarded businesses and their integrations</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-500 font-medium">Total Businesses</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{businesses.length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-500 font-medium">Telegram Connected</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-2">
                        {businesses.filter(b => b.integrations.telegram).length}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-500 font-medium">Facebook Connected</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                        {businesses.filter(b => b.integrations.facebook).length}
                    </p>
                </div>
            </div>

            {/* Businesses Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Integrations</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FAQs</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onboarded</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {businesses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No businesses onboarded yet
                                    </td>
                                </tr>
                            ) : (
                                businesses.map((business) => (
                                    <tr key={business.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                                    <Building2 size={20} className="text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{business.name}</p>
                                                    <p className="text-xs text-gray-500">{business.id.substring(0, 8)}...</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {business.owner ? (
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{business.owner.name}</p>
                                                    <p className="text-xs text-gray-500">{business.owner.email}</p>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">No owner</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${business.integrations.telegram
                                                    ? 'bg-indigo-50 text-indigo-700'
                                                    : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    <MessageSquare size={12} />
                                                    Telegram
                                                    {business.integrations.telegram ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                </div>
                                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${business.integrations.facebook
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    <Facebook size={12} />
                                                    Facebook
                                                    {business.integrations.facebook ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                </div>
                                            </div>
                                            {business.facebookPageName && (
                                                <p className="text-xs text-gray-500 mt-1">{business.facebookPageName}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                                {business.faqCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <Calendar size={14} />
                                                {formatDistanceToNow(new Date(business.createdAt), { addSuffix: true })}
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
