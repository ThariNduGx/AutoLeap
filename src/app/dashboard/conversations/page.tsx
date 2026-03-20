'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MessageSquare, Bot, User, RefreshCw, AlertTriangle, CheckCircle, ShieldAlert, Send, Loader2, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
    id: string;
    customer_chat_id: string;
    intent: string;
    status: string;
    last_message_at: string;
    created_at: string;
    history: any[];
    state: any;
}

const INTENT_COLORS: Record<string, string> = {
    booking: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    faq: 'bg-blue-50 text-blue-700 border-blue-100',
    complaint: 'bg-red-50 text-red-700 border-red-100',
    greeting: 'bg-green-50 text-green-700 border-green-100',
    status: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    unknown: 'bg-gray-50 text-gray-600 border-gray-100',
};

export default function ConversationsPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [intentFilter, setIntentFilter] = useState('');
    const [selected, setSelected] = useState<Conversation | null>(null);
    const [takingOver, setTakingOver] = useState<string | null>(null);
    const [error, setError] = useState('');

    // Human reply state
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [replyError, setReplyError] = useState('');
    const msgEndRef = useRef<HTMLDivElement>(null);

    const fetchConversations = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (statusFilter) params.set('status', statusFilter);
            if (intentFilter) params.set('intent', intentFilter);
            const res = await fetch(`/api/conversations?${params}`);
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            setConversations(data);
            // Keep selected in sync
            if (selected) {
                const refreshed = data.find((c: Conversation) => c.id === selected.id);
                if (refreshed) setSelected(refreshed);
            }
        } catch {
            setError('Failed to load conversations');
        } finally {
            setLoading(false);
        }
    }, [selected, search, statusFilter, intentFilter]);

    useEffect(() => {
        fetchConversations();
        // Poll every 10 seconds for new conversations
        const timer = setInterval(fetchConversations, 10_000);
        return () => clearInterval(timer);
    }, [fetchConversations]);

    async function sendReply() {
        if (!selected || !replyText.trim() || sending) return;
        setSending(true);
        setReplyError('');
        try {
            const res = await fetch(`/api/conversations/${selected.id}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: replyText.trim() }),
            });
            if (res.ok) {
                setReplyText('');
                await fetchConversations();
                setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            } else {
                const data = await res.json();
                setReplyError(data.error || 'Failed to send');
            }
        } finally {
            setSending(false);
        }
    }

    async function toggleTakeover(conv: Conversation) {
        const newStatus = conv.status === 'human' ? 'ai' : 'human';
        setTakingOver(conv.id);
        try {
            const res = await fetch(`/api/conversations/${conv.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                await fetchConversations();
            }
        } finally {
            setTakingOver(null);
        }
    }

    // Filtering is now server-side; display all returned conversations
    const filtered = conversations;

    // Extract last message text from history
    function getLastMessage(conv: Conversation): string {
        if (!conv.history || conv.history.length === 0) return 'No messages yet';
        const last = conv.history[conv.history.length - 1];
        const parts = last?.parts || [];
        for (const p of parts) {
            if (p?.text) return p.text.substring(0, 80);
        }
        return 'No text';
    }

    return (
        <div className="grid h-[calc(100vh-120px)] grid-cols-1 md:grid-cols-5 gap-4 p-4">

            {/* LEFT: Conversation list */}
            <div className="md:col-span-2 flex flex-col rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-gray-900">Conversations</h2>
                        <div className="flex items-center gap-1">
                            <a
                                href="/api/conversations/export?days=30"
                                download
                                title="Export last 30 days as CSV"
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <Download size={15} />
                            </a>
                            <button onClick={fetchConversations} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                                <RefreshCw size={15} />
                            </button>
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by chat ID or message..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-600"
                        >
                            <option value="">All statuses</option>
                            <option value="ai">AI</option>
                            <option value="human">Human</option>
                            <option value="escalated">Escalated</option>
                        </select>
                        <select
                            value={intentFilter}
                            onChange={e => setIntentFilter(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-600"
                        >
                            <option value="">All intents</option>
                            <option value="booking">Booking</option>
                            <option value="faq">FAQ</option>
                            <option value="complaint">Complaint</option>
                            <option value="greeting">Greeting</option>
                            <option value="status">Status</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
                    ) : error ? (
                        <div className="p-8 text-center text-red-500 text-sm">{error}</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                            No conversations yet
                        </div>
                    ) : (
                        filtered.map(conv => (
                            <button
                                key={conv.id}
                                onClick={() => { setSelected(conv); setReplyError(''); setReplyText(''); }}
                                className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.id === conv.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {conv.status === 'escalated' ? (
                                            <ShieldAlert size={14} className="text-red-500 shrink-0" />
                                        ) : conv.status === 'human' ? (
                                            <User size={14} className="text-orange-500 shrink-0" />
                                        ) : (
                                            <Bot size={14} className="text-indigo-500 shrink-0" />
                                        )}
                                        <span className="text-sm font-medium text-gray-800 truncate font-mono">
                                            {conv.customer_chat_id}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-400 shrink-0">
                                        {formatDistanceToNow(new Date(conv.last_message_at || conv.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${INTENT_COLORS[conv.intent] || INTENT_COLORS.unknown}`}>
                                        {conv.intent}
                                    </span>
                                    {conv.status === 'complaint' || conv.status === 'escalated' ? (
                                        <AlertTriangle size={12} className="text-red-500" />
                                    ) : null}
                                    {conv.state?.booked ? (
                                        <CheckCircle size={12} className="text-green-500" />
                                    ) : null}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 truncate">{getLastMessage(conv)}</p>
                            </button>
                        ))
                    )}
                </div>

                <div className="p-3 border-t border-gray-100 text-xs text-gray-400 text-center">
                    {filtered.length} conversation{filtered.length !== 1 ? 's' : ''} · auto-refreshes every 10s
                </div>
            </div>

            {/* RIGHT: Conversation detail */}
            <div className="md:col-span-3 flex flex-col rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                {!selected ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-3">
                        <MessageSquare size={40} className="opacity-20" />
                        <p className="text-sm">Select a conversation to view details</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-gray-900 font-mono">{selected.customer_chat_id}</p>
                                    {selected.status === 'escalated' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full border border-red-200">
                                            <ShieldAlert size={11} /> Escalated
                                        </span>
                                    )}
                                    {selected.status === 'human' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full border border-orange-200">
                                            <User size={11} /> Human
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Intent: <span className="font-medium">{selected.intent}</span>
                                    {selected.state?.booked && <span className="ml-2 text-green-600">✓ Booked</span>}
                                    {selected.state?.selected_date && !selected.state.booked && (
                                        <span className="ml-2 text-indigo-600">Slot: {selected.state.selected_date} {selected.state.selected_time}</span>
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={() => toggleTakeover(selected)}
                                disabled={!!takingOver}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                                    selected.status === 'human' || selected.status === 'escalated'
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                }`}
                            >
                                {selected.status === 'human' || selected.status === 'escalated' ? <Bot size={14} /> : <User size={14} />}
                                {selected.status === 'human' || selected.status === 'escalated' ? 'Return to AI' : 'Take Over'}
                            </button>
                        </div>

                        {/* Message history */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/40">
                            {(!selected.history || selected.history.length === 0) ? (
                                <p className="text-center text-gray-400 text-sm py-8">No message history</p>
                            ) : (
                                selected.history
                                    .filter((h: any) => h.role === 'user' || h.role === 'model' || h.role === 'owner')
                                    .map((h: any, i: number) => {
                                        const isUser = h.role === 'user';
                                        const isOwner = h.role === 'owner';
                                        const text = h.parts?.find((p: any) => p.text)?.text || '';
                                        if (!text) return null;
                                        return (
                                            <div key={i} className={`flex ${isUser || isOwner ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                                                    isUser
                                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                                        : isOwner
                                                        ? 'bg-orange-500 text-white rounded-tr-none'
                                                        : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                                                }`}>
                                                    {isOwner && (
                                                        <p className="text-xs opacity-70 mb-0.5 font-medium">You (owner)</p>
                                                    )}
                                                    {text}
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                            <div ref={msgEndRef} />
                        </div>

                        {/* Status banners + Reply box */}
                        {selected.status === 'escalated' && (
                            <div className="px-3 pt-2 bg-red-50 border-t border-red-200 text-xs text-red-700 flex items-center gap-2">
                                <ShieldAlert size={12} />
                                Escalated — customer flagged a complaint. AI is paused.
                            </div>
                        )}

                        {/* Human-mode reply box */}
                        {(selected.status === 'human' || selected.status === 'escalated') && (
                            <div className="p-3 border-t border-gray-100 bg-white">
                                {replyError && (
                                    <p className="text-xs text-red-600 mb-2">{replyError}</p>
                                )}
                                <div className="flex gap-2">
                                    <textarea
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendReply();
                                            }
                                        }}
                                        placeholder="Type a reply... (Enter to send, Shift+Enter for new line)"
                                        rows={2}
                                        maxLength={4000}
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                    <button
                                        onClick={sendReply}
                                        disabled={sending || !replyText.trim()}
                                        className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-1.5 text-sm font-medium disabled:opacity-50 transition-colors self-end"
                                    >
                                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                        Send
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    AI is paused. Click &quot;Return to AI&quot; to hand back to automation.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
