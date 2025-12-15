"use client"

import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

const tiers = [
    {
        name: "Starter",
        price: "$29",
        description: "Perfect for solopreneurs and small teams just getting started.",
        features: [
            "AI Chatbot (up to 100 chats/mo)",
            "Basic Scheduling",
            "Email Support",
            "1 Team Member",
        ],
        highlight: false,
    },
    {
        name: "Pro",
        price: "$79",
        description: "The best value for growing service businesses.",
        features: [
            "Unlimited AI Chatbot",
            "Advanced Scheduling & Payments",
            "Priority Support",
            "Up to 5 Team Members",
            "SMS Notifications",
        ],
        highlight: true,
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "For large organizations requiring custom solutions.",
        features: [
            "Custom AI Training",
            "API Access",
            "Dedicated Account Manager",
            "Unlimited Team Members",
            "SLA Support",
        ],
        highlight: false,
    },
]

export function LandingPricing() {
    return (
        <section id="pricing" className="py-24 bg-background relative overflow-hidden">
            <div className="container px-4 md:px-6 mx-auto relative z-10">
                <div className="text-center space-y-4 mb-16">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                        Choose the plan that fits your business needs. No hidden fees.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {tiers.map((tier, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className={`relative rounded-2xl p-8 shadow-sm flex flex-col ${tier.highlight
                                ? "bg-muted/40 shadow-lg scale-105 z-10"
                                : "bg-background"
                                }`}
                        >
                            <div className="mb-8 items-start">
                                <h3 className="text-lg font-semibold leading-none mb-2">{tier.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold">{tier.price}</span>
                                    {tier.price !== "Custom" && <span className="text-muted-foreground">/mo</span>}
                                </div>
                                <p className="text-muted-foreground mt-4 text-sm">{tier.description}</p>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {tier.features.map((feature, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm">
                                        <Check className="h-4 w-4 text-primary shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-8 mt-auto">
                                <Link href={tier.name === "Enterprise" ? "/contact" : "/auth/signup"}>
                                    <Button
                                        className={`w-full ${tier.highlight ? "" : "bg-muted text-foreground hover:bg-muted/80"}`}
                                        variant={tier.highlight ? "default" : "secondary"}
                                    >
                                        {tier.name === "Enterprise" ? "Contact Sales" : "Get Started"}
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
