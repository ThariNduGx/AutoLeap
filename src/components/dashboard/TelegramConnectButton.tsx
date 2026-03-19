'use client';

import { useState } from 'react';
import { Send, Loader2, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';

interface TelegramConnectProps {
    businessId: string;
    onSuccess: () => void;
}

export default function TelegramConnectButton({ businessId, onSuccess }: TelegramConnectProps) {
    const [botToken, setBotToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showInstructions, setShowInstructions] = useState(false);

    async function handleConnect() {
        if (!botToken.trim()) {
            setError('Please enter your bot token');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/telegram/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bot_token: botToken,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to connect Telegram bot');
            }

            // Success!
            setLoading(false);
            setBotToken('');
            onSuccess();
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
                <Send size={32} className="text-indigo-600" />
                <div>
                    <h3 className="font-semibold text-gray-900">Connect Telegram Bot</h3>
                    <p className="text-sm text-gray-500">Connect your bot to receive customer messages</p>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {!showInstructions ? (
                <div className="text-center">
                    <button
                        onClick={() => setShowInstructions(true)}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                    >
                        Get Started
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Step-by-Step Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</span>
                            Create Your Telegram Bot
                        </h4>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 ml-8">
                            <li>Open Telegram and search for <code className="bg-gray-200 px-2 py-0.5 rounded">@BotFather</code></li>
                            <li>Send the command: <code className="bg-gray-200 px-2 py-0.5 rounded">/newbot</code></li>
                            <li>Follow the prompts to choose a name and username for your bot</li>
                            <li>BotFather will give you a <strong>Bot Token</strong> - copy it!</li>
                        </ol>
                        <a
                            href="https://t.me/BotFather"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                            Open @BotFather <ExternalLink size={14} />
                        </a>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2">
                            <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
                            Paste Your Bot Token
                        </h4>
                        <input
                            type="text"
                            value={botToken}
                            onChange={(e) => setBotToken(e.target.value)}
                            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500">
                            Example format: <code className="bg-gray-200 px-1 py-0.5 rounded">110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw</code>
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowInstructions(false)}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConnect}
                            disabled={loading || !botToken.trim()}
                            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    Connect Bot
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                    <strong>Note:</strong> Your bot token is stored securely and never shared. We'll automatically register the webhook for you.
                </p>
            </div>
        </div>
    );
}
