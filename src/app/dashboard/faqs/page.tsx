'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Tag, Loader2, Upload, FileText, CheckCircle2, AlertCircle, TrendingUp, Sparkles, Pencil } from 'lucide-react';

export default function FAQsPage() {
    const [faqs, setFaqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');

    // C3: FAQ suggestions
    const [suggestions, setSuggestions]     = useState<{ question: string; answer: string }[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [suggestError, setSuggestError]   = useState('');
    const [addingIdx, setAddingIdx]         = useState<number | null>(null);

    // Add / Edit modal (shared)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFaq, setEditingFaq] = useState<any | null>(null); // null = adding, object = editing
    const [modalFaq, setModalFaq] = useState({ question: '', answer: '', category: 'general' });
    const [saving, setSaving] = useState(false);

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [uploadState, setUploadState] = useState<
        'idle' | 'uploading' | 'success' | 'error'
    >('idle');
    const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchFaqs();
    }, []);

    // BUG 19 FIX: Show error state when fetch fails instead of silent empty list
    async function fetchFaqs() {
        try {
            const res = await fetch('/api/faqs');
            const data = await res.json();
            if (!res.ok || !Array.isArray(data)) {
                setFetchError(data.error || 'Failed to load FAQs. Please refresh.');
            } else {
                setFetchError('');
                setFaqs(data);
            }
        } catch (err) {
            setFetchError('Network error. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    }

    function openAddModal() {
        setEditingFaq(null);
        setModalFaq({ question: '', answer: '', category: 'general' });
        setIsModalOpen(true);
    }

    function openEditModal(faq: any) {
        setEditingFaq(faq);
        setModalFaq({ question: faq.question, answer: faq.answer, category: faq.category || 'general' });
        setIsModalOpen(true);
    }

    // BUG 18 FIX: Shared save handler for both add and edit
    async function handleSaveFaq() {
        setSaving(true);
        try {
            const isEdit = editingFaq !== null;
            const res = await fetch('/api/faqs', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isEdit ? { id: editingFaq.id, ...modalFaq } : modalFaq),
            });
            if (res.ok) {
                setIsModalOpen(false);
                setModalFaq({ question: '', answer: '', category: 'general' });
                setEditingFaq(null);
                fetchFaqs();
            } else {
                const data = await res.json();
                alert(data.error || `Failed to ${isEdit ? 'update' : 'save'} FAQ`);
            }
        } catch {
            alert('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadState('uploading');
        setUploadResult(null);

        try {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch('/api/faqs/bulk', { method: 'POST', body: form });
            const data = await res.json();

            if (res.ok && data.success) {
                setUploadState('success');
                setUploadResult({ imported: data.imported, skipped: data.skipped });
                fetchFaqs();
            } else {
                setUploadState('error');
            }
        } catch {
            setUploadState('error');
        } finally {
            // Reset file input so the same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    // BUG 17 FIX: Check res.ok before removing from UI; rollback on failure
    async function handleDelete(id: string) {
        try {
            const res = await fetch(`/api/faqs?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setFaqs(prev => prev.filter(f => f.id !== id));
            } else {
                alert('Failed to delete. Please try again.');
            }
        } catch {
            alert('Network error. Please try again.');
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">FAQ Management</h1>
                    <p className="text-gray-500 mt-1">
                        {faqs.length} FAQs &mdash; {faqs.reduce((s, f) => s + (f.hit_count ?? 0), 0)} total hits
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* CSV upload status */}
                    {uploadState === 'success' && uploadResult && (
                        <span className="flex items-center gap-1 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                            <CheckCircle2 size={14} />
                            {uploadResult.imported} imported, {uploadResult.skipped} skipped
                        </span>
                    )}
                    {uploadState === 'error' && (
                        <span className="flex items-center gap-1 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                            <AlertCircle size={14} />
                            Upload failed
                        </span>
                    )}

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleCSVUpload}
                    />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadState === 'uploading'}
                        className="border border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors disabled:opacity-50"
                        title="Upload CSV with columns: question, answer, category"
                    >
                        {uploadState === 'uploading'
                            ? <Loader2 size={16} className="animate-spin" />
                            : <Upload size={16} />
                        }
                        {uploadState === 'uploading' ? 'Uploading...' : 'Import CSV'}
                    </button>

                    <button
                        onClick={openAddModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                    >
                        <Plus size={20} />
                        Add FAQ
                    </button>
                    <button
                        onClick={async () => {
                            setLoadingSuggestions(true); setSuggestError(''); setSuggestions([]);
                            try {
                                const res = await fetch('/api/faqs/suggest', { method: 'POST' });
                                const data = await res.json();
                                if (data.suggestions) setSuggestions(data.suggestions);
                                else setSuggestError(data.error || 'Failed to analyse');
                            } catch { setSuggestError('Network error'); }
                            finally { setLoadingSuggestions(false); }
                        }}
                        disabled={loadingSuggestions}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loadingSuggestions ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        Suggest FAQs
                    </button>
                </div>
            </div>

            {/* AI-suggested FAQs panel */}
            {(suggestions.length > 0 || suggestError) && (
                <div className="mb-6 bg-purple-50 border border-purple-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-purple-800 flex items-center gap-2">
                            <Sparkles size={15} /> AI Suggested FAQs
                        </p>
                        <button onClick={() => setSuggestions([])} className="text-purple-400 hover:text-purple-700"><FileText size={14} /></button>
                    </div>
                    {suggestError && <p className="text-sm text-red-600">{suggestError}</p>}
                    <div className="space-y-3">
                        {suggestions.map((s, i) => (
                            <div key={i} className="bg-white rounded-xl border border-purple-100 p-4">
                                <p className="text-sm font-semibold text-gray-800 mb-1">{s.question}</p>
                                <p className="text-sm text-gray-600 mb-3">{s.answer}</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            setAddingIdx(i);
                                            try {
                                                const res = await fetch('/api/faqs', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ question: s.question, answer: s.answer, category: 'suggested' }),
                                                });
                                                // BUG 16 FIX: POST returns { success: true }, not the FAQ object.
                                                // Refresh the list to get the real FAQ with its server-assigned ID.
                                                if (res.ok) {
                                                    setSuggestions(p => p.filter((_, j) => j !== i));
                                                    fetchFaqs();
                                                }
                                            } finally { setAddingIdx(null); }
                                        }}
                                        disabled={addingIdx === i}
                                        className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
                                        {addingIdx === i ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add to FAQ
                                    </button>
                                    <button onClick={() => setSuggestions(p => p.filter((_, j) => j !== i))}
                                        className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading FAQs...</div>
            ) : fetchError ? (
                // BUG 19 FIX: Show error state instead of silent empty list
                <div className="text-center py-12">
                    <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
                    <p className="text-red-600 font-medium">{fetchError}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {faqs.length === 0 && (
                        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                            <FileText size={32} className="mx-auto mb-3 text-gray-300" />
                            <p className="font-medium text-gray-500">No FAQs yet</p>
                            <p className="text-sm mt-1">Add one manually or import a CSV file.</p>
                            <p className="text-xs mt-3 text-gray-400">
                                CSV format: <code className="bg-gray-100 px-1 rounded">question,answer,category</code>
                            </p>
                        </div>
                    )}
                    {faqs.map((faq) => (
                        <div key={faq.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.question}</h3>
                                <div className="flex items-center gap-2">
                                    {/* BUG 18 FIX: Edit button */}
                                    {deletingId !== faq.id && (
                                        <button
                                            onClick={() => openEditModal(faq)}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Edit FAQ"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                    )}
                                    {deletingId === faq.id ? (
                                        <>
                                            <button
                                                onClick={() => handleDelete(faq.id)}
                                                className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                            >
                                                Delete
                                            </button>
                                            <button
                                                onClick={() => setDeletingId(null)}
                                                className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setDeletingId(faq.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">{faq.answer}</p>
                            <div className="flex flex-wrap gap-2">
                                <span className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full font-medium">
                                    <Tag size={12} />
                                    {faq.category || 'general'}
                                </span>
                                {(faq.hit_count ?? 0) > 0 && (
                                    <span className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full font-medium">
                                        <TrendingUp size={12} />
                                        {faq.hit_count} hit{faq.hit_count !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit modal (BUG 18 FIX: shared for both operations) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                        <h2 className="text-xl font-bold mb-4">
                            {editingFaq ? 'Edit FAQ' : 'Add New FAQ'}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                                <input
                                    value={modalFaq.question}
                                    onChange={e => setModalFaq({ ...modalFaq, question: e.target.value })}
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. What is your location?"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                                <textarea
                                    value={modalFaq.answer}
                                    onChange={e => setModalFaq({ ...modalFaq, answer: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 h-32 resize-none outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Type the answer here..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <input
                                    value={modalFaq.category}
                                    onChange={e => setModalFaq({ ...modalFaq, category: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. pricing, location"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => { setIsModalOpen(false); setEditingFaq(null); }}
                                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveFaq}
                                    disabled={saving}
                                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 size={16} className="animate-spin" />}
                                    {saving ? 'Saving...' : editingFaq ? 'Update FAQ' : 'Save FAQ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
