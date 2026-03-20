'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Loader2, ShieldCheck, Building2, KeyRound, Check, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'business';
    businessName: string | null;
    createdAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [page, setPage] = useState(1);

    // Password reset state per user
    const [resetingId, setResetingId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [resetStatus, setResetStatus] = useState<Record<string, 'success' | 'error' | null>>({});
    const [resetMessage, setResetMessage] = useState<Record<string, string>>({});

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '25' });
            if (search) params.set('search', search);
            if (roleFilter) params.set('role', roleFilter);

            const res = await fetch(`/api/admin/users?${params}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to fetch users');
                return;
            }
            setUsers(data.users || []);
            setPagination(data.pagination || null);
        } catch (err) {
            setError('Failed to load users');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page, search, roleFilter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Reset to page 1 when search/filter changes
    function applySearch(val: string) { setSearch(val); setPage(1); }
    function applyRole(val: string) { setRoleFilter(val); setPage(1); }

    function startReset(userId: string) {
        setResetingId(userId);
        setNewPassword('');
        setResetStatus(prev => ({ ...prev, [userId]: null }));
        setResetMessage(prev => ({ ...prev, [userId]: '' }));
    }

    function cancelReset() { setResetingId(null); setNewPassword(''); }

    async function submitReset(userId: string) {
        if (!newPassword || newPassword.length < 8) {
            setResetStatus(prev => ({ ...prev, [userId]: 'error' }));
            setResetMessage(prev => ({ ...prev, [userId]: 'Password must be at least 8 characters' }));
            return;
        }
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setResetStatus(prev => ({ ...prev, [userId]: 'success' }));
                setResetMessage(prev => ({ ...prev, [userId]: 'Password updated successfully' }));
                setResetingId(null);
                setNewPassword('');
            } else {
                setResetStatus(prev => ({ ...prev, [userId]: 'error' }));
                setResetMessage(prev => ({ ...prev, [userId]: data.error || 'Failed to reset password' }));
            }
        } catch {
            setResetStatus(prev => ({ ...prev, [userId]: 'error' }));
            setResetMessage(prev => ({ ...prev, [userId]: 'Network error. Please try again.' }));
        }
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Users</h1>
                <p className="text-gray-500 mt-1">Manage all platform user accounts and reset passwords</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                        <Users size={20} className="text-gray-400" />
                        <p className="text-sm text-gray-500 font-medium">Total Users</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{pagination?.total ?? '—'}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                        <ShieldCheck size={20} className="text-red-400" />
                        <p className="text-sm text-gray-500 font-medium">Admin Accounts</p>
                    </div>
                    <p className="text-3xl font-bold text-red-600">{users.filter(u => u.role === 'admin').length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                        <Building2 size={20} className="text-indigo-400" />
                        <p className="text-sm text-gray-500 font-medium">Business Accounts</p>
                    </div>
                    <p className="text-3xl font-bold text-indigo-600">{users.filter(u => u.role === 'business').length}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => applySearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={e => applyRole(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                    <option value="">All roles</option>
                    <option value="business">Business</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-red-600">{error}</div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="animate-spin text-gray-400" size={36} />
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                No users found{search ? ` matching "${search}"` : ''}
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((user) => (
                                            <>
                                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div>
                                                            <p className="font-medium text-gray-900">{user.name}</p>
                                                            <p className="text-xs text-gray-500">{user.email}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                                            user.role === 'admin'
                                                                ? 'bg-red-50 text-red-700'
                                                                : 'bg-indigo-50 text-indigo-700'
                                                        }`}>
                                                            {user.role === 'admin' ? <ShieldCheck size={12} /> : <Building2 size={12} />}
                                                            {user.role === 'admin' ? 'Admin' : 'Business'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                        {user.businessName ?? <span className="text-gray-400">—</span>}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {resetingId === user.id ? (
                                                            <button onClick={cancelReset} className="text-xs text-gray-500 hover:text-gray-700 underline">Cancel</button>
                                                        ) : (
                                                            <button
                                                                onClick={() => startReset(user.id)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                                            >
                                                                <KeyRound size={13} />
                                                                Reset Password
                                                            </button>
                                                        )}
                                                        {resetStatus[user.id] === 'success' && (
                                                            <span className="flex items-center gap-1 text-xs text-green-600 mt-1">
                                                                <Check size={12} /> {resetMessage[user.id]}
                                                            </span>
                                                        )}
                                                        {resetStatus[user.id] === 'error' && resetingId !== user.id && (
                                                            <span className="flex items-center gap-1 text-xs text-red-500 mt-1">
                                                                <X size={12} /> {resetMessage[user.id]}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>

                                                {/* Inline password reset row */}
                                                {resetingId === user.id && (
                                                    <tr key={`reset-${user.id}`} className="bg-yellow-50 border-l-4 border-yellow-400">
                                                        <td colSpan={5} className="px-6 py-4">
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <p className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                                                    New password for <span className="text-gray-900">{user.name}</span>:
                                                                </p>
                                                                <input
                                                                    type="password"
                                                                    placeholder="Min. 8 characters"
                                                                    value={newPassword}
                                                                    onChange={e => setNewPassword(e.target.value)}
                                                                    onKeyDown={e => e.key === 'Enter' && submitReset(user.id)}
                                                                    className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    onClick={() => submitReset(user.id)}
                                                                    className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={cancelReset}
                                                                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                {resetStatus[user.id] === 'error' && (
                                                                    <span className="text-xs text-red-500">{resetMessage[user.id]}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination controls */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                                <p className="text-sm text-gray-500">
                                    Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => p - 1)}
                                        disabled={!pagination.hasPrev}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-sm text-gray-700 font-medium">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={!pagination.hasNext}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
