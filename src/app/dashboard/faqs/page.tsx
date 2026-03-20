'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Tag, Loader2, Upload, FileText, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';

export default function FAQsPage() {
    const [faqs, setFaqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newFaq, setNewFaq] = useState({ question: '', answer: '', category: 'general' });
    const [saving, setSaving] = useState(false);
    const [uploadState, setUploadState] = useState<
        'idle' | 'uploading' | 'success' | 'error'
    >('idle');
    const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchFaqs();
    }, []);

    async function fetchFaqs() {
        try {
            const res = await fetch('/api/faqs');
            const data = await res.json();
            if (Array.isArray(data)) setFaqs(data);
        } catch (err) {
            console.error('Failed to fetch FAQs', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddFaq() {
        setSaving(true);
        try {
            const res = await fetch('/api/faqs', {
                method: 'POST',
                body: JSON.stringify(newFaq),
            });
            if (res.ok) {
                setIsModalOpen(false);
                setNewFaq({ question: '', answer: '', category: 'general' });
                fetchFaqs(); // Refresh list
            } else {
                alert('Failed to save FAQ');
            }
        } catch (err) {
            alert('Error saving FAQ');
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

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this FAQ?')) return;
        try {
            await fetch(`/api/faqs?id=${id}`, { method: 'DELETE' });
            setFaqs(faqs.filter(f => f.id !== id));
        } catch (err) {
            alert('Failed to delete');
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
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                    >
                        <Plus size={20} />
                        Add FAQ
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading FAQs...</div>
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
                                <div className="flex gap-2">
                                    <button onClick={() => handleDelete(faq.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 size={18} />
                                    </button>
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

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                        <h2 className="text-xl font-bold mb-4">Add New FAQ</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                                <input
                                    value={newFaq.question}
                                    onChange={e => setNewFaq({ ...newFaq, question: e.target.value })}
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. What is your location?"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                                <textarea
                                    value={newFaq.answer}
                                    onChange={e => setNewFaq({ ...newFaq, answer: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 h-32 resize-none outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Type the answer here..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <input
                                    value={newFaq.category}
                                    onChange={e => setNewFaq({ ...newFaq, category: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. pricing, location"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button
                                    onClick={handleAddFaq}
                                    disabled={saving}
                                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 size={16} className="animate-spin" />}
                                    {saving ? 'Saving...' : 'Save FAQ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
