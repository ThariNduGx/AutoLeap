'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, ChevronRight, Loader2 } from 'lucide-react';

const SERVICE_OPTIONS = ['Plumbing', 'Electrical', 'Cleaning', 'Salon', 'Catering', 'Other'];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Step 1
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    // Step 2
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // Step 3
    const [weekdayStart, setWeekdayStart] = useState('09:00');
    const [weekdayEnd, setWeekdayEnd] = useState('17:00');
    const [weekendStart, setWeekendStart] = useState('10:00');
    const [weekendEnd, setWeekendEnd] = useState('14:00');

    function toggleCategory(cat: string) {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    }

    function canProceed() {
        if (step === 1) return name.trim().length > 0;
        if (step === 2) return selectedCategories.length > 0;
        return true;
    }

    /**
     * Saves all onboarding data (steps 1–3 + business_hours) to the database.
     * Returns true on success, false on error (error state is set on the component).
     *
     * Called by both "Finish Setup" and "Connect Google Calendar" so that data is
     * always persisted before we navigate away from this page.
     */
    async function saveOnboardingData(): Promise<boolean> {
        // Expand weekday/weekend into the per-day JSONB format the DB expects:
        // { monday: { open, close, enabled }, ..., sunday: { open, close, enabled } }
        const business_hours = {
            monday:    { open: weekdayStart, close: weekdayEnd, enabled: true },
            tuesday:   { open: weekdayStart, close: weekdayEnd, enabled: true },
            wednesday: { open: weekdayStart, close: weekdayEnd, enabled: true },
            thursday:  { open: weekdayStart, close: weekdayEnd, enabled: true },
            friday:    { open: weekdayStart, close: weekdayEnd, enabled: true },
            saturday:  { open: weekendStart, close: weekendEnd, enabled: weekendStart !== weekendEnd },
            sunday:    { open: weekendStart, close: weekendEnd, enabled: false },
        };

        try {
            const res = await fetch('/api/onboarding/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    phone: phone.trim(),
                    service_categories: selectedCategories,
                    business_hours,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Failed to save. Please try again.');
                return false;
            }
            return true;
        } catch {
            setError('Network error. Please try again.');
            return false;
        }
    }

    async function finish() {
        setSaving(true);
        setError('');
        try {
            if (await saveOnboardingData()) {
                router.push('/dashboard');
            }
        } finally {
            setSaving(false);
        }
    }

    /**
     * Saves onboarding data first, then redirects to the Google OAuth flow.
     * Using window.location.href (not router.push) because the target is an API
     * route that performs a server-side redirect to Google's consent page.
     *
     * The ?from=onboarding param tells the OAuth callback to redirect back to
     * /dashboard (instead of /dashboard/calendar) once the flow completes.
     */
    async function connectCalendar() {
        setSaving(true);
        setError('');
        try {
            if (await saveOnboardingData()) {
                window.location.href = '/api/auth/google?from=onboarding';
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="container flex h-screen items-center justify-center">
            <Card className="w-[600px] border-0 shadow-lg bg-card/50 backdrop-blur-xl">
                <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex space-x-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className={`h-2 w-12 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`}
                                />
                            ))}
                        </div>
                        <span className="text-sm text-muted-foreground">Step {step} of 4</span>
                    </div>
                    <CardTitle>
                        {step === 1 && 'Tell us about your business'}
                        {step === 2 && 'What services do you offer?'}
                        {step === 3 && 'Set your operating hours'}
                        {step === 4 && 'Connect your calendar'}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 && 'We need some basic details to get started.'}
                        {step === 2 && 'Select the categories that best describe your work.'}
                        {step === 3 && 'When are you available for appointments?'}
                        {step === 4 && 'Sync with Google Calendar to avoid double bookings.'}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {step === 1 && (
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="businessName">Business Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="businessName"
                                    placeholder="Acme Plumbing"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    placeholder="+94 77 123 4567"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                {SERVICE_OPTIONS.map((service) => {
                                    const active = selectedCategories.includes(service);
                                    return (
                                        <button
                                            key={service}
                                            type="button"
                                            onClick={() => toggleCategory(service)}
                                            className={`flex items-center gap-3 border p-4 rounded-md cursor-pointer transition-colors text-left ${active
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'hover:bg-accent/50'
                                                }`}
                                        >
                                            <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${active ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                                            <span>{service}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedCategories.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center">Select at least one service category.</p>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between border-b pb-4">
                                <span className="text-sm font-medium">Weekdays</span>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="time"
                                        className="w-28"
                                        value={weekdayStart}
                                        onChange={e => setWeekdayStart(e.target.value)}
                                    />
                                    <span className="text-muted-foreground text-sm">to</span>
                                    <Input
                                        type="time"
                                        className="w-28"
                                        value={weekdayEnd}
                                        onChange={e => setWeekdayEnd(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Weekends</span>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="time"
                                        className="w-28"
                                        value={weekendStart}
                                        onChange={e => setWeekendStart(e.target.value)}
                                    />
                                    <span className="text-muted-foreground text-sm">to</span>
                                    <Input
                                        type="time"
                                        className="w-28"
                                        value={weekendEnd}
                                        onChange={e => setWeekendEnd(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                            <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600">
                                <Calendar className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="font-medium">Google Calendar</h3>
                                <p className="text-sm text-muted-foreground">
                                    Connect your calendar so AutoLeap can check your availability in real-time.
                                    You can also do this later from the Calendar page.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full max-w-xs"
                                onClick={connectCalendar}
                                disabled={saving}
                            >
                                {saving ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                                ) : (
                                    'Connect Google Calendar'
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground">Optional — you can skip this step.</p>
                        </div>
                    )}

                    {error && (
                        <p className="mt-3 text-sm text-red-600">{error}</p>
                    )}
                </CardContent>

                <CardFooter className="flex justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => setStep(s => s - 1)}
                        disabled={step === 1 || saving}
                    >
                        Back
                    </Button>
                    <Button
                        onClick={step === 4 ? finish : () => setStep(s => s + 1)}
                        disabled={!canProceed() || saving}
                    >
                        {saving ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                        ) : step === 4 ? (
                            'Finish Setup'
                        ) : (
                            <>Continue <ChevronRight className="ml-2 h-4 w-4" /></>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
