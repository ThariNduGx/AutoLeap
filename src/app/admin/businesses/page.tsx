'use client';

import { useEffect, useState } from 'react';
import {
    Building2, CheckCircle2, XCircle, MessageSquare, Facebook,
    Calendar, Loader2, Pencil, Trash2, Ban, ShieldCheck, Check, X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Business {
    id: string;
    name: string;
    isActive: boolean;
    owner: { email: string; name: string } | null;
    integrations: { telegram: boolean; facebook: boolean };
    facebookPageName: string | null;
    faqCount: number;
    createdAt: string;
}

export default function BusinessesPage() {
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    // Delete state
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteInProgress, setDeleteInProgress] = useState(false);

    // Suspend/activate feedback
    const [togglingId, setTogglingId] = useState<string | null>(null);

    useEffect(() => { fetchBusinesses(); }, []);

    async function fetchBusinesses() {
        try {
            const res = await fetch('/api/admin/businesses');
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Failed to fetch businesses'); return; }
            setBusinesses(data.businesses || []);
        } catch (err) {
            setError('Failed to load businesses');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // ── Edit name ──────────────────────────────────────────────
    function startEdit(biz: Business) {
        setEditingId(biz.id);
        setEditName(biz.name);
    }

    async function saveEdit(id: string) {
        if (!editName.trim()) return;
        setEditSaving(true);
        try {
            const res = await fetch(`/api/admin/businesses/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim() }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setBusinesses(prev => prev.map(b => b.id === id ? { ...b, name: data.business.name } : b));
                setEditingId(null);
            }
        } finally {
            setEditSaving(false);
        }
    }

    // ── Suspend / Activate ─────────────────────────────────────
    async function toggleActive(biz: Business) {
        setTogglingId(biz.id);
        try {
            const res = await fetch(`/api/admin/businesses/${biz.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !biz.isActive }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setBusinesses(prev => prev.map(b => b.id === biz.id ? { ...b, isActive: data.business.is_active } : b));
            }
        } finally {
            setTogglingId(null);
        }
    }

    // ── Delete ─────────────────────────────────────────────────
    function startDelete(id: string) {
        setDeletingId(id);
        setDeleteConfirm('');
    }

    async function confirmDelete(biz: Business) {
        if (deleteConfirm !== biz.name) return;
        setDeleteInProgress(true);
        try {
            const res = await fetch(`/api/admin/businesses/${biz.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                setBusinesses(prev => prev.filter(b => b.id !== biz.id));
                setDeletingId(null);
            }
        } finally {
            setDeleteInProgress(false);
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

    const activeCount = businesses.filter(b => b.isActive).length;
    const suspendedCount = businesses.filter(b => !b.isActive).length;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
                <p className="text-gray-500 mt-1">Manage all onboarded businesses — edit, suspend, or delete accounts</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{businesses.length}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{activeCount}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Suspended</p>
                    <p className="text-3xl font-bold text-red-500 mt-1">{suspendedCount}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Telegram</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-1">
                        {businesses.filter(b => b.integrations.telegram).length}
                    </p>
                </div>
            </div>

            {/* Businesses Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channels</th>
                                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FAQs</th>
                                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onboarded</th>
                                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {businesses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                                        No businesses onboarded yet
                                    </td>
                                </tr>
                            ) : (
                                businesses.map((biz) => (
                                    <>
                                        {/* Main row */}
                                        <tr
                                            key={biz.id}
                                            className={`transition-colors ${!biz.isActive ? 'bg-red-50/40 opacity-70' : 'hover:bg-gray-50'}`}
                                        >
                                            {/* Business name cell — editable */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${biz.isActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                                        <Building2 size={18} className={biz.isActive ? 'text-indigo-600' : 'text-gray-400'} />
                                                    </div>
                                                    <div>
                                                        {editingId === biz.id ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    value={editName}
                                                                    onChange={e => setEditName(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') saveEdit(biz.id);
                                                                        if (e.key === 'Escape') setEditingId(null);
                                                                    }}
                                                                    className="text-sm font-medium border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-36"
                                                                    autoFocus
                                                                />
                                                                <button onClick={() => saveEdit(biz.id)} disabled={editSaving} className="text-green-600 hover:text-green-700">
                                                                    <Check size={15} />
                                                                </button>
                                                                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                                                                    <X size={15} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="font-medium text-gray-900 text-sm">{biz.name}</p>
                                                                {!biz.isActive && (
                                                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">Suspended</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-gray-400 mt-0.5">{biz.id.substring(0, 8)}…</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Owner */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {biz.owner ? (
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{biz.owner.name}</p>
                                                        <p className="text-xs text-gray-400">{biz.owner.email}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>

                                            {/* Integrations */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${biz.integrations.telegram ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
                                                        <MessageSquare size={11} />
                                                        {biz.integrations.telegram ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                    </span>
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${biz.integrations.facebook ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                                        <Facebook size={11} />
                                                        {biz.integrations.facebook ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* FAQs */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                                    {biz.faqCount}
                                                </span>
                                            </td>

                                            {/* Onboarded */}
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <Calendar size={13} />
                                                    {formatDistanceToNow(new Date(biz.createdAt), { addSuffix: true })}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {/* Edit */}
                                                    <button
                                                        onClick={() => startEdit(biz)}
                                                        title="Edit name"
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    >
                                                        <Pencil size={15} />
                                                    </button>

                                                    {/* Suspend / Activate */}
                                                    <button
                                                        onClick={() => toggleActive(biz)}
                                                        disabled={togglingId === biz.id}
                                                        title={biz.isActive ? 'Suspend' : 'Activate'}
                                                        className={`p-1.5 rounded-lg transition-colors ${biz.isActive
                                                            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                                            : 'text-green-600 hover:bg-green-50'
                                                        }`}
                                                    >
                                                        {togglingId === biz.id
                                                            ? <Loader2 size={15} className="animate-spin" />
                                                            : biz.isActive ? <Ban size={15} /> : <ShieldCheck size={15} />
                                                        }
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => startDelete(biz.id)}
                                                        title="Delete business"
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Delete confirmation row */}
                                        {deletingId === biz.id && (
                                            <tr key={`del-${biz.id}`} className="bg-red-50 border-l-4 border-red-500">
                                                <td colSpan={6} className="px-5 py-4">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <Trash2 size={16} className="text-red-500 flex-shrink-0" />
                                                        <p className="text-sm text-red-700 font-medium">
                                                            Type <span className="font-bold">"{biz.name}"</span> to confirm permanent deletion:
                                                        </p>
                                                        <input
                                                            value={deleteConfirm}
                                                            onChange={e => setDeleteConfirm(e.target.value)}
                                                            placeholder={biz.name}
                                                            className="flex-1 min-w-40 max-w-xs px-3 py-1.5 text-sm border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => confirmDelete(biz)}
                                                            disabled={deleteConfirm !== biz.name || deleteInProgress}
                                                            className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
                                                        >
                                                            {deleteInProgress ? <Loader2 size={13} className="animate-spin" /> : null}
                                                            Delete permanently
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingId(null)}
                                                            className="text-sm text-gray-500 hover:text-gray-700"
                                                        >
                                                            Cancel
                                                        </button>
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
            </div>
        </div>
    );
}
