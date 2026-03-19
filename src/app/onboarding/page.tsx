"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, ChevronRight, Calendar, Clock, Briefcase, User } from "lucide-react"

export default function OnboardingPage() {
    const [step, setStep] = useState(1)

    const nextStep = () => setStep(step + 1)
    const prevStep = () => setStep(step - 1)

    return (
        <div className="container flex h-screen items-center justify-center">
            <Card className="w-[600px] border-0 shadow-lg bg-card/50 backdrop-blur-xl">
                <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex space-x-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className={`h-2 w-12 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"
                                        }`}
                                />
                            ))}
                        </div>
                        <span className="text-sm text-muted-foreground">Step {step} of 4</span>
                    </div>
                    <CardTitle>
                        {step === 1 && "Tell us about your business"}
                        {step === 2 && "What services do you offer?"}
                        {step === 3 && "Set your operating hours"}
                        {step === 4 && "Connect your calendar"}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 && "We need some basic details to get started."}
                        {step === 2 && "Select the categories that best describe your work."}
                        {step === 3 && "When are you available for appointments?"}
                        {step === 4 && "Sync with Google Calendar to avoid double bookings."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 1 && (
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="businessName">Business Name</Label>
                                <Input id="businessName" placeholder="Acme Plumbing" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" placeholder="+94 77 123 4567" />
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                {["Plumbing", "Electrical", "Cleaning", "Salon", "Catering", "Other"].map((service) => (
                                    <div key={service} className="flex items-center space-x-2 border p-4 rounded-md cursor-pointer hover:bg-accent/50 transition-colors">
                                        <div className="h-4 w-4 rounded-full border border-primary" />
                                        <span>{service}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {step === 3 && (
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between border-b pb-4">
                                <span>Weekdays</span>
                                <div className="flex items-center gap-2">
                                    <Input className="w-24" defaultValue="09:00" />
                                    <span>to</span>
                                    <Input className="w-24" defaultValue="17:00" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Weekends</span>
                                <div className="flex items-center gap-2">
                                    <Input className="w-24" defaultValue="10:00" />
                                    <span>to</span>
                                    <Input className="w-24" defaultValue="14:00" />
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
                                <p className="text-sm text-muted-foreground">Sync your schedule automatically</p>
                            </div>
                            <Button variant="outline" className="w-full max-w-xs">Connect Google Calendar</Button>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="ghost" onClick={prevStep} disabled={step === 1}>
                        Back
                    </Button>
                    <Button onClick={step === 4 ? () => { } : nextStep}>
                        {step === 4 ? "Finish Setup" : "Continue"} <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
