'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        businessName: '',
        name: '',
        email: '',
        password: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Signup failed');
                setIsLoading(false);
                return;
            }

            // Success! Redirect to login
            router.push('/auth/login?success=true');
        } catch (err) {
            setError('An unexpected error occurred');
            setIsLoading(false);
        }
    };

    return (
        <div className="container relative flex h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
            <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
                <div className="absolute inset-0 bg-zinc-900" />
                <div className="relative z-20 flex items-center text-lg font-medium">
                    <div className="mr-2 h-6 w-6 rounded-full bg-primary" />
                    AutoLeap
                </div>
                <div className="relative z-20 mt-auto">
                    <blockquote className="space-y-2">
                        <p className="text-lg">
                            &ldquo;Joining AutoLeap was the best decision for my plumbing service. It's like having a personal assistant 24/7.&rdquo;
                        </p>
                        <footer className="text-sm">Alex Chen</footer>
                    </blockquote>
                </div>
            </div>
            <div className="lg:p-8">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Create an account
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Enter your details below to create your account
                        </p>
                    </div>
                    <Card className="border-0 shadow-none">
                        <form onSubmit={handleSubmit}>
                            <CardContent className="grid gap-4 p-0">
                                {error && (
                                    <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
                                        {error}
                                    </div>
                                )}
                                <div className="grid gap-2">
                                    <Label htmlFor="businessName">Business Name</Label>
                                    <Input
                                        id="businessName"
                                        type="text"
                                        placeholder="Raj's AC Services"
                                        value={formData.businessName}
                                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Your Name</Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        placeholder="Raj Kumar"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="raj@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Minimum 8 characters"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                        minLength={8}
                                        disabled={isLoading}
                                    />
                                </div>
                                <Button className="w-full" type="submit" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating account...
                                        </>
                                    ) : (
                                        'Sign Up'
                                    )}
                                </Button>
                            </CardContent>
                            <CardFooter className="flex flex-col gap-2 p-0 mt-4">
                                <p className="px-8 text-center text-sm text-muted-foreground">
                                    By clicking continue, you agree to our{" "}
                                    <Link
                                        href="/terms"
                                        className="underline underline-offset-4 hover:text-primary"
                                    >
                                        Terms of Service
                                    </Link>{" "}
                                    and{" "}
                                    <Link
                                        href="/privacy"
                                        className="underline underline-offset-4 hover:text-primary"
                                    >
                                        Privacy Policy
                                    </Link>
                                    .
                                </p>
                            </CardFooter>
                        </form>
                    </Card>
                    <p className="px-8 text-center text-sm text-muted-foreground">
                        <Link
                            href="/auth/login"
                            className="hover:text-brand underline underline-offset-4"
                        >
                            Already have an account? Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
