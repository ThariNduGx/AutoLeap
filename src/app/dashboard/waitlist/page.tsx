'use client';

import { useState, useEffect } from 'react';
import { Users, RefreshCw, Trash2, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WaitlistEntry {
    id: string;
    customer_chat_id: string;
    platform: string;
    customer_name: string | null;
    service_type: string | null;
    preferred_date: string | null;
    notified_at: string | null;
    created_at: string;
}

export default function WaitlistPage() {
    const [entries, setEntries] = useState<WaitlistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);

    async function fetchEntries() {
        try {
            const res = await fetch('/api/waitlist');
            if (!res.ok) throw new Error('Failed to load');
            setEntries(await res.json());
        } catch {
            setError('Failed to load waitlist');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchEntries(); }, []);

    async function handleDelete(id: string) {
        setDeleting(id);
        try {
            await fetch(`/api/waitlist?id=${id}`, { method: 'DELETE' });
            await fetchEntries();
        } finally {
            setDeleting(null);
        }
    }

    const pending = entries.filter(e => !e.notified_at);
    const notified = entries.filter(e => e.notified_at);

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Customers who requested a slot when appointments were fully booked
                    </p>
                </div>
                <button
                    onClick={fetchEntries}
                    className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 size={32} className="animate-spin text-gray-300" />
                </div>
            ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Users size={40} className="opacity-20 mb-3" />
                    <p className="text-sm">No one is on the waitlist right now</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Pending */}
                    {pending.length > 0 && (
                        <section>
                            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Clock size={12} /> Awaiting Notification ({pending.length})
                            </h2>
                            <div className="space-y-2">
                                {pending.map(entry => (
                                    <EntryRow key={entry.id} entry={entry} onDelete={handleDelete} deleting={deleting} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Notified */}
                    {notified.length > 0 && (
                        <section>
                            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <CheckCircle2 size={12} className="text-green-500" /> Notified ({notified.length})
                            </h2>
                            <div className="space-y-2 opacity-70">
                                {notified.map(entry => (
                                    <EntryRow key={entry.id} entry={entry} onDelete={handleDelete} deleting={deleting} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

function EntryRow({
    entry,
    onDelete,
    deleting,
}: {
    entry: WaitlistEntry;
    onDelete: (id: string) => void;
    deleting: string | null;
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4 shadow-sm">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-gray-900">{entry.customer_chat_id}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full capitalize">{entry.platform}</span>
                    {entry.notified_at && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Notified</span>
                    )}
                </div>

                <div className="flex flex-wrap gap-4 mt-1.5">
                    {entry.customer_name && (
                        <span className="text-xs text-gray-500">Name: <strong>{entry.customer_name}</strong></span>
                    )}
                    {entry.service_type && (
                        <span className="text-xs text-gray-500">Service: <strong>{entry.service_type}</strong></span>
                    )}
                    {entry.preferred_date && (
                        <span className="text-xs text-gray-500">Preferred: <strong>{entry.preferred_date}</strong></span>
                    )}
                </div>

                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                    <span>Joined {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                    {entry.notified_at && (
                        <span>Notified {formatDistanceToNow(new Date(entry.notified_at), { addSuffix: true })}</span>
                    )}
                </div>
            </div>

            <button
                onClick={() => onDelete(entry.id)}
                disabled={deleting === entry.id}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                title="Remove from waitlist"
            >
                {deleting === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
        </div>
    );
}
