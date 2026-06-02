import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, BarChart2, Calendar, ShoppingBag, Link as LinkIcon } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-50">
        <Link href="/" className="flex items-center justify-center gap-2">
          <img src="/logo.svg" alt="CreatorHub Logo" className="h-8 w-8" />
          <span className="font-bold text-xl tracking-tight text-foreground">CreatorHub</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up">
            <Button className="rounded-full shadow-sm text-sm h-9 px-4">Get Started</Button>
          </Link>
        </nav>
      </header>
      
      <main className="flex-1">
        <section className="w-full py-20 lg:py-32 xl:py-40 flex justify-center overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center space-y-8 text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                <Sparkles className="mr-2 h-4 w-4" />
                The digital HQ for African creators
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                Grow, Monetize & Manage Your <span className="text-primary">Creator Brand</span> in One Place.
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl leading-relaxed">
                Everything you need to turn your audience into a business. Link-in-bio, digital store, content planner, and AI assistant — built for the next generation of African digital entrepreneurs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Link href="/sign-up">
                  <Button size="lg" className="w-full sm:w-auto rounded-full text-base h-12 px-8 shadow-md">
                    Start for free <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-20 md:py-32 bg-muted/30 border-y border-border/50 flex justify-center">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Your complete creator toolkit</h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">Replace 5 different subscriptions with one powerful platform designed specifically for your needs.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border transition-all hover:shadow-md hover:border-primary/30">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <LinkIcon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Link-in-Bio</h3>
                <p className="text-muted-foreground leading-relaxed">Create a stunning mobile-first landing page for all your content, social profiles, and products.</p>
              </div>
              
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border transition-all hover:shadow-md hover:border-primary/30">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Digital Store</h3>
                <p className="text-muted-foreground leading-relaxed">Sell ebooks, presets, templates, and courses directly to your audience with zero hassle.</p>
              </div>
              
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border transition-all hover:shadow-md hover:border-primary/30">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <Calendar className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Content Planner</h3>
                <p className="text-muted-foreground leading-relaxed">Organize your posting schedule across TikTok, Instagram, YouTube, and more in one visual calendar.</p>
              </div>
              
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border transition-all hover:shadow-md hover:border-primary/30">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">AI Assistant</h3>
                <p className="text-muted-foreground leading-relaxed">Generate endless content ideas, viral hooks, and engaging captions tailored to your niche.</p>
              </div>
              
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border transition-all hover:shadow-md hover:border-primary/30">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <BarChart2 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Analytics</h3>
                <p className="text-muted-foreground leading-relaxed">Understand your audience with detailed insights into link clicks, profile views, and product sales.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="w-full py-8 md:py-12 border-t border-border bg-background flex justify-center">
        <div className="container px-4 md:px-6 flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="CreatorHub Logo" className="h-6 w-6 grayscale opacity-70" />
            <span className="font-semibold text-muted-foreground">CreatorHub</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} CreatorHub. All rights reserved. Made for African Creators.
          </p>
        </div>
      </footer>
    </div>
  );
}