"use client"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { motion } from "framer-motion"

const faqs = [
    {
        question: "How does the AI Chatbot work?",
        answer: "Our AI is trained on your business data to understand services, pricing, and availability. It converses naturally with leads to answer questions and book appointments 24/7.",
    },
    {
        question: "Do I need technical skills to set this up?",
        answer: "Not at all. AutoLeap is designed for non-technical business owners. Our onboarding takes less than 15 minutes, and we provide templates for every industry.",
    },
    {
        question: "Can I integrate with my existing calendar?",
        answer: "Yes! We integrate seamlessly with Google Calendar, Outlook, and iCloud to ensure you never get double-booked.",
    },
    {
        question: "Is my customer data secure?",
        answer: "Absolutely. We use enterprise-grade encryption and strictly adhere to privacy standards. Your data is yours alone.",
    },
]

export function LandingFaq() {
    return (
        <section id="about" className="py-24 bg-muted/30">
            <div className="container px-4 md:px-6 mx-auto max-w-3xl">
                <div className="text-center space-y-4 mb-12">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-muted-foreground">
                        Everything you need to know about AutoLeap.
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    viewport={{ once: true }}
                >
                    <Accordion type="single" collapsible className="w-full">
                        {faqs.map((faq, index) => (
                            <AccordionItem key={index} value={`item-${index}`} className="border-none bg-background shadow-sm rounded-lg mb-4 px-4">
                                <AccordionTrigger className="text-left hover:no-underline hover:text-primary transition-colors">{faq.question}</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </motion.div>
            </div>
        </section>
    )
}
