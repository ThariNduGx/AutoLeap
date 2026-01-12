'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ConnectContent() {
    const searchParams = useSearchParams();
    const businessId = searchParams.get('businessId') || 'ecac4a78-8df3-40de-96ae-73c955047b3b'; // Default for dev

    const handleConnect = () => {
        window.location.href = `/api/auth/google?business_id=${businessId}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Google Calendar</h1>
                <p className="text-gray-600 mb-8">
                    Enable AutoLeap to check your availability and book appointments automatically.
                </p>

                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg text-left">
                        <h3 className="font-medium text-gray-900 mb-1">What we'll do:</h3>
                        <ul className="text-sm text-gray-600 space-y-2">
                            <li className="flex items-center">
                                <span className="text-green-500 mr-2">✓</span>
                                Check free/busy time slots
                            </li>
                            <li className="flex items-center">
                                <span className="text-green-500 mr-2">✓</span>
                                Create new appointments
                            </li>
                            <li className="flex items-center">
                                <span className="text-green-500 mr-2">✓</span>
                                Avoid double-bookings
                            </li>
                        </ul>
                    </div>

                    <button
                        onClick={handleConnect}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        Connect with Google
                    </button>

                    <p className="text-xs text-gray-500 mt-4">
                        Business ID: {businessId}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function ConnectPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ConnectContent />
        </Suspense>
    );
}
