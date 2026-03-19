"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

export function LandingHero() {
    return (
        <section className="relative overflow-hidden pt-14 pb-20 md:pt-20 md:pb-32">
            {/* Background gradients */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
            <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] bg-blue-400/10 blur-[100px] rounded-full opacity-50" />
            <div className="absolute bottom-0 left-0 -z-10 h-[500px] w-[500px] bg-purple-400/10 blur-[100px] rounded-full opacity-50" />

            <div className="container px-4 md:px-6 mx-auto">
                <div className="flex flex-col items-center text-center space-y-8">

                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center rounded-full px-3 py-1 text-sm text-muted-foreground backdrop-blur-sm bg-muted/50 shadow-sm"
                    >
                        <Sparkles className="mr-2 h-3 w-3 text-primary" />
                        <span className="text-xs font-medium">New: AI-Powered Scheduling v2.0</span>
                    </motion.div>

                    {/* Heading */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl"
                    >
                        Automate Your Service Business with <span className="text-primary">AutoLeap</span>
                    </motion.h1>

                    {/* Subheading */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="mx-auto max-w-[700px] text-lg text-muted-foreground md:text-xl"
                    >
                        Handle leads, scheduling, and customer support 24/7 without lifting a finger.
                        The all-in-one platform designed to scale your service business.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 w-full justify-center"
                    >
                        <Link href="/auth/signup">
                            <Button size="lg" className="h-12 px-8 rounded-full text-base w-full sm:w-auto shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href="/auth/login">
                            <Button variant="outline" size="lg" className="h-12 px-8 rounded-full text-base w-full sm:w-auto backdrop-blur-sm bg-background/50">
                                View Demo
                            </Button>
                        </Link>
                    </motion.div>

                    {/* Dashboard Preview Mockup */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, rotateX: 10 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{ duration: 0.8, delay: 0.4, type: "spring" }}
                        className="mt-16 w-full max-w-5xl rounded-xl bg-background/50 shadow-2xl backdrop-blur-sm overflow-hidden relative group perspective-1000"
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
                        <div className="p-2 bg-muted/20 border-b flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400" />
                            <div className="w-3 h-3 rounded-full bg-yellow-400" />
                            <div className="w-3 h-3 rounded-full bg-green-400" />
                        </div>
                        {/* Abstract UI Representation */}
                        <div className="grid grid-cols-4 gap-4 p-8 min-h-[400px] relative">
                            {/* Sidebar */}
                            <div className="col-span-1 space-y-4">
                                <div className="h-8 w-3/4 bg-muted/40 rounded animate-pulse" />
                                <div className="space-y-2 pt-4">
                                    <div className="h-4 w-full bg-muted/20 rounded" />
                                    <div className="h-4 w-full bg-muted/20 rounded" />
                                    <div className="h-4 w-full bg-muted/20 rounded" />
                                    <div className="h-4 w-4/5 bg-muted/20 rounded" />
                                </div>
                            </div>
                            {/* Main Content */}
                            <div className="col-span-3 space-y-6">
                                <div className="flex justify-between">
                                    <div className="h-10 w-1/3 bg-muted/40 rounded" />
                                    <div className="h-10 w-10 bg-primary/20 rounded-full" />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="h-32 rounded-lg bg-primary/5 border border-primary/10 p-4 space-y-2">
                                        <div className="h-4 w-1/2 bg-primary/20 rounded" />
                                        <div className="h-8 w-full bg-primary/10 rounded mt-4" />
                                    </div>
                                    <div className="h-32 rounded-lg bg-muted/30 p-4 space-y-2">
                                        <div className="h-4 w-1/2 bg-muted/40 rounded" />
                                        <div className="h-8 w-full bg-muted/20 rounded mt-4" />
                                    </div>
                                    <div className="h-32 rounded-lg bg-muted/30 p-4 space-y-2">
                                        <div className="h-4 w-1/2 bg-muted/40 rounded" />
                                        <div className="h-8 w-full bg-muted/20 rounded mt-4" />
                                    </div>
                                </div>
                                <div className="h-64 rounded-lg bg-muted/10 border p-4">
                                    <div className="h-full w-full bg-gradient-to-br from-transparent to-muted/20 rounded flex items-center justify-center text-muted-foreground/30 font-mono text-sm">
                                        Interactive Dashboard Visualization
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
