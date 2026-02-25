'use client';

import { useEffect, useState } from 'react';
import { Facebook, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FacebookConnectButtonProps {
    businessId: string;
    onSuccess: () => void;
}

export default function FacebookConnectButton({ businessId, onSuccess }: FacebookConnectButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Handle redirect-back result (fb_success or fb_error in URL)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fbSuccess = params.get('fb_success');
        const fbError = params.get('fb_error');

        if (fbSuccess === '1') {
            // Clean the URL and signal success
            const clean = window.location.pathname;
            window.history.replaceState({}, '', clean);
            onSuccess();
        } else if (fbError) {
            const messages: Record<string, string> = {
                cancelled: 'Facebook login was cancelled.',
                no_pages: 'No Facebook Pages found. Make sure you selected a Page during authorization.',
                token_exchange_failed: 'Failed to exchange Facebook token. Please try again.',
                pages_fetch_failed: 'Could not retrieve your Facebook Pages from Facebook.',
                db_error: 'Page found but failed to save. Please try again.',
                server_config_error: 'Server configuration error — FACEBOOK_APP_SECRET is missing.',
                invalid_state: 'Authorization session expired. Please try again.',
                no_business: 'No business is linked to your account.',
            };
            setError(messages[fbError] || `Authorization failed (${fbError}). Please try again.`);
            // Clean the URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [onSuccess]);

    function handleConnect() {
        setLoading(true);
        setError('');
        // Redirect to server-side OAuth flow
        window.location.href = '/api/auth/facebook';
    }

    return (
        <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
            <Facebook size={40} className="text-blue-600 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900 mb-2">Connect Your Facebook Page</h3>
            <p className="text-sm text-gray-500 mb-4">
                Connect your Facebook Page to handle customer messages with AI
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-left">
                    <div className="flex items-center gap-2 font-medium">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                </div>
            )}

            <button
                onClick={handleConnect}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
                {loading ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Connecting...
                    </>
                ) : (
                    <>
                        <Facebook size={16} />
                        Connect Facebook Page
                    </>
                )}
            </button>

            <p className="text-xs text-gray-400 mt-3">
                You'll be redirected to Facebook to authorize access
            </p>
        </div>
    );
}
