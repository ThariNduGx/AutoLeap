"use client"

import { motion } from "framer-motion"
import {
    MessageSquare,
    Calendar,
    Users,
    Zap,
    Shield,
    BarChart3
} from "lucide-react"

const features = [
    {
        icon: MessageSquare,
        title: "24/7 AI Chatbot",
        description: "Instantly respond to leads on your website, SMS, and social media at any time of day."
    },
    {
        icon: Calendar,
        title: "Smart Scheduling",
        description: "Let customers book appointments directly into your calendar without the back-and-forth."
    },
    {
        icon: Users,
        title: "Lead Management",
        description: "Capture, qualify, and organize every lead in one central dashboard."
    },
    {
        icon: Zap,
        title: "Instant Invoicing",
        description: "Generate and send professional invoices immediately after a job is completed."
    },
    {
        icon: Shield,
        title: "Secure Payments",
        description: "Accept credit cards and bank transfers securely with integrated payment processing."
    },
    {
        icon: BarChart3,
        title: "Business Insights",
        description: "Track revenue, booking rates, and customer satisfaction with detailed analytics."
    }
]

export function LandingFeatures() {
    return (
        <section id="features" className="py-24 bg-muted/30 relative">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="text-center space-y-4 mb-16">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary">
                        Features built for growth
                    </h2>
                    <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                        Everything you need to run your service business efficiently and increase revenue.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="group p-8 rounded-2xl bg-background shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="relative z-10">
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                                    <feature.icon className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
