'use client';

import { useState, useEffect } from 'react';
import { Star, Loader2, MessageSquare } from 'lucide-react';

interface Review {
    id: string;
    rating: number;
    comment?: string;
    platform?: string;
    customer_chat_id?: string;
    created_at: string;
    appointments?: {
        customer_name: string;
        service_type: string;
        appointment_date: string;
    };
}

const STAR_COLOURS = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-lime-500', 'text-green-500'];

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <span className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} size={size} className={n <= rating ? STAR_COLOURS[rating] : 'text-gray-200'} fill={n <= rating ? 'currentColor' : 'none'} />
            ))}
        </span>
    );
}

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/reviews')
            .then(r => r.json())
            .then(d => { if (Array.isArray(d)) setReviews(d); })
            .finally(() => setLoading(false));
    }, []);

    const avg = reviews.length
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : null;

    const distribution = [5, 4, 3, 2, 1].map(star => ({
        star,
        count: reviews.filter(r => r.rating === star).length,
        pct: reviews.length ? Math.round((reviews.filter(r => r.rating === star).length / reviews.length) * 100) : 0,
    }));

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
                <p className="text-sm text-gray-500 mt-0.5">Post-appointment ratings sent automatically to customers via Telegram</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-300" /></div>
            ) : reviews.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
                    <strong>No reviews yet.</strong> Reviews are sent automatically 2 hours after each appointment via Telegram.
                    They will appear here once customers respond.
                </div>
            ) : (
                <>
                    {/* Summary */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 flex items-center gap-8">
                        <div className="text-center">
                            <p className="text-5xl font-bold text-gray-900">{avg}</p>
                            <Stars rating={Math.round(Number(avg))} size={18} />
                            <p className="text-xs text-gray-400 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex-1 space-y-1.5">
                            {distribution.map(({ star, count, pct }) => (
                                <div key={star} className="flex items-center gap-2 text-xs">
                                    <span className="w-4 text-right text-gray-600">{star}</span>
                                    <Star size={10} className="text-yellow-400" fill="currentColor" />
                                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                                        <div className="bg-yellow-400 rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="w-6 text-gray-400">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Review list */}
                    <div className="space-y-3">
                        {reviews.map(r => (
                            <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {r.appointments?.customer_name || 'Anonymous'}
                                        </p>
                                        {r.appointments && (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {r.appointments.service_type} — {r.appointments.appointment_date}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Stars rating={r.rating} />
                                        <span className="text-xs text-gray-400">
                                            {new Date(r.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                {r.comment && (
                                    <p className="text-sm text-gray-600 mt-2 flex items-start gap-2">
                                        <MessageSquare size={13} className="mt-0.5 flex-shrink-0 text-gray-400" />
                                        {r.comment}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
