import Link from "next/link"
import { LandingHero } from "@/components/landing/hero"
import { LandingFeatures } from "@/components/landing/features"
import { LandingPricing } from "@/components/landing/pricing"
import { LandingFaq } from "@/components/landing/faq"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 md:px-6 h-16 flex items-center justify-between mx-auto">
          <Link className="flex items-center gap-2" href="#">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">A</span>
            </div>
            <span className="font-bold text-xl tracking-tight">AutoLeap</span>
          </Link>
          <nav className="hidden md:flex gap-8">
            <Link className="text-sm font-medium hover:text-primary transition-colors scroll-smooth" href="#features">
              Features
            </Link>
            <Link className="text-sm font-medium hover:text-primary transition-colors scroll-smooth" href="#pricing">
              Pricing
            </Link>
            <Link className="text-sm font-medium hover:text-primary transition-colors scroll-smooth" href="#about">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <LandingHero />
        <LandingFeatures />
        <LandingPricing />
        <LandingFaq />

        {/* CTA Section */}
        <section className="py-24 bg-primary text-primary-foreground">
          <div className="container px-4 md:px-6 mx-auto text-center space-y-8">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Ready to automate your growth?
            </h2>
            <p className="mx-auto max-w-[600px] text-primary-foreground/80 md:text-xl">
              Join thousands of service businesses using AutoLeap to save time and make more money.
            </p>
            <Link href="/auth/signup">
              <Button size="lg" variant="secondary" className="h-12 px-8 rounded-full text-base shadow-xl">
                Start Your Free Trial
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-muted/20">
        <div className="container px-4 md:px-6 mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary" />
            <span className="font-bold text-lg">AutoLeap</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 AutoLeap Inc. All rights reserved.
          </p>
          <nav className="flex gap-6">
            <Link className="text-sm text-muted-foreground hover:text-primary transition-colors" href="#">
              Terms
            </Link>
            <Link className="text-sm text-muted-foreground hover:text-primary transition-colors" href="#">
              Privacy
            </Link>
            <Link className="text-sm text-muted-foreground hover:text-primary transition-colors" href="#">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
