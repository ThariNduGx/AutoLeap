'use client';

import { useState, useEffect } from 'react';
import { Facebook, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FacebookConnectButtonProps {
    businessId: string;
    onSuccess: () => void;
}

// Declare Facebook SDK types
declare global {
    interface Window {
        FB: any;
        fbAsyncInit: () => void;
    }
}

export default function FacebookConnectButton({ businessId, onSuccess }: FacebookConnectButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sdkLoaded, setSdkLoaded] = useState(false);

    useEffect(() => {
        // Load Facebook SDK
        loadFacebookSDK();
    }, []);

    function loadFacebookSDK() {
        if (document.getElementById('facebook-jssdk')) {
            setSdkLoaded(true);
            return;
        }

        window.fbAsyncInit = function () {
            window.FB.init({
                appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '123456789', // Replace with your Facebook App ID
                cookie: true,
                xfbml: true,
                version: 'v19.0'
            });
            setSdkLoaded(true);
        };

        // Load the SDK asynchronously
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
    }

    async function handleFacebookLogin() {
        if (!sdkLoaded) {
            setError('Facebook SDK not loaded');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Request Facebook Login with required permissions
            window.FB.login(
                async function (response: any) {
                    if (response.authResponse) {
                        const userAccessToken = response.authResponse.accessToken;

                        // Call our backend to exchange token for Page Access Token
                        await connectFacebookPage(userAccessToken);
                    } else {
                        setError('Facebook login was cancelled');
                        setLoading(false);
                    }
                },
                {
                    scope: 'pages_show_list,pages_messaging,pages_manage_metadata',
                    auth_type: 'rerequest' // Ask again for permissions if previously denied
                }
            );
        } catch (err: any) {
            setError(err.message || 'Failed to connect Facebook');
            setLoading(false);
        }
    }

    async function connectFacebookPage(userAccessToken: string) {
        try {
            const res = await fetch('/api/facebook/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_access_token: userAccessToken,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to connect Facebook Page');
            }

            // Success!
            setLoading(false);
            onSuccess();
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
            <Facebook size={40} className="text-blue-600 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900 mb-2">Connect Your Facebook Page</h3>
            <p className="text-sm text-gray-500 mb-4">
                Connect your Facebook Page to handle customer messages with AI
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <button
                onClick={handleFacebookLogin}
                disabled={loading || !sdkLoaded}
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

            {!sdkLoaded && (
                <p className="text-xs text-gray-400 mt-2">Loading Facebook SDK...</p>
            )}
        </div>
    );
}
