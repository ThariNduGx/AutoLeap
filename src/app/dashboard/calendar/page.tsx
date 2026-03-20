'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { CheckCircle2, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

interface BusinessSettings {
    has_google_calendar: boolean;
    google_calendar_email: string | null;
}

export default function CalendarPage() {
    const [settings, setSettings] = useState<BusinessSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    // Read ?connected=true or ?error=... from redirect after OAuth
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('connected') === 'true') {
            setStatusMsg('Google Calendar connected successfully.');
            window.history.replaceState({}, '', '/dashboard/calendar');
        } else if (params.get('error')) {
            setStatusMsg(`Connection failed: ${params.get('error')}`);
            window.history.replaceState({}, '', '/dashboard/calendar');
        }
    }, []);

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch('/api/business/settings');
            if (!res.ok) return;
            const data = await res.json();
            if (data.business) {
                setSettings({
                    has_google_calendar: data.business.has_google_calendar,
                    google_calendar_email: data.business.google_calendar_email,
                });
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    async function disconnect() {
        setDisconnecting(true);
        try {
            const res = await fetch('/api/business/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ disconnect_google_calendar: true }),
            });
            if (res.ok) {
                setSettings(s => s ? { ...s, has_google_calendar: false, google_calendar_email: null } : s);
                setStatusMsg('Google Calendar disconnected.');
            }
        } finally {
            setDisconnecting(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Calendar Integration</h2>
                <p className="text-muted-foreground">Manage your calendar connections.</p>
            </div>

            {statusMsg && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${statusMsg.includes('failed') || statusMsg.includes('Disconnected')
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    : 'bg-green-50 text-green-800 border border-green-200'
                    }`}>
                    {statusMsg.includes('failed') ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {statusMsg}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Google Calendar</CardTitle>
                    <CardDescription>
                        AutoLeap checks your Google Calendar to avoid double-bookings and syncs confirmed appointments automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                    ) : settings?.has_google_calendar ? (
                        <div className="flex items-center justify-between bg-muted/40 p-4 rounded-xl">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                                    G
                                </div>
                                <div>
                                    <div className="font-medium">Google Calendar</div>
                                    <div className="text-sm text-muted-foreground">
                                        {settings.google_calendar_email ?? 'Connected'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Connected
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={disconnect}
                                    disabled={disconnecting}
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                            <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
                                G
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">Not connected</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Connect your Google Calendar to enable smart availability checks.
                                </p>
                            </div>
                            <Button asChild className="mt-2">
                                <a href="/api/auth/google">Connect Google Calendar</a>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sync Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="font-medium">Availability Check</div>
                            <div className="text-sm text-muted-foreground">
                                AutoLeap checks your calendar in real-time when a customer requests a slot.
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchSettings}
                            disabled={!settings?.has_google_calendar}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" /> Refresh Status
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
