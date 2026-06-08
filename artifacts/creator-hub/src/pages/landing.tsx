import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Sparkles, BarChart2, Calendar, ShoppingBag, Link as LinkIcon,
  Wallet, Users, Bell, Wand2, Bot, Package, CheckCircle, TrendingUp, Globe, Zap
} from "lucide-react";

const FEATURES = [
  {
    icon: LinkIcon,
    title: "Link-in-Bio",
    description: "Create a stunning mobile-first landing page for all your content, social profiles, and products — fully customizable.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: ShoppingBag,
    title: "Digital Store",
    description: "Sell ebooks, presets, templates, and courses directly to your audience with instant Paystack checkout.",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    icon: Calendar,
    title: "Content Planner",
    description: "Organize your posting schedule across TikTok, Instagram, YouTube, and more in one visual calendar.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: Sparkles,
    title: "AI Content Suite",
    description: "Generate captions, viral hooks, video scripts, and brand bios powered by GPT-4 — trained for African creators.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: BarChart2,
    title: "Deep Analytics",
    description: "Track link clicks, profile views, ad impressions, and product sales with beautiful real-time dashboards.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    icon: Wallet,
    title: "Creator Wallet",
    description: "Earn from every ad impression, product sale, and brand deal. Withdraw to your bank account anytime.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Package,
    title: "Marketplace",
    description: "List your services and digital products on the CreatorHub marketplace and reach new customers daily.",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    icon: Bot,
    title: "AI Chat Assistant",
    description: "Chat with an AI trained to help you grow your creator business, plan campaigns, and answer niche questions.",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Invite your virtual assistant or co-creator to manage your dashboard, content, and store together.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "₦0",
    period: "forever",
    color: "border-border",
    features: ["Link-in-bio page", "Up to 10 links", "Basic analytics", "1 digital product", "AI credits (10/month)"],
  },
  {
    name: "Creator Pro",
    price: "₦4,900",
    period: "/ month",
    color: "border-primary",
    highlight: true,
    features: ["Unlimited links & products", "Advanced analytics", "AI credits (150/month)", "Ad revenue sharing", "Priority support"],
  },
  {
    name: "Creator Business",
    price: "₦9,900",
    period: "/ month",
    color: "border-amber-500",
    features: ["Everything in Pro", "Team members", "Marketplace listings", "AI credits (400/month)", "Custom domain", "White-label profile"],
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background overflow-x-hidden">
      {/* Nav */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-50">
        <Link href="/" className="flex items-center justify-center gap-2">
          <img src="/logo.svg" alt="CreatorHub Logo" className="h-8 w-8" />
          <span className="font-bold text-xl tracking-tight text-foreground">CreatorHub</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors hidden sm:block">
            Sign In
          </Link>
          <Link href="/sign-up">
            <Button className="rounded-full shadow-sm text-sm h-9 px-4">Get Started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="w-full py-20 lg:py-32 xl:py-40 flex justify-center overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "4s" }} />
          <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "6s" }} />

          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center space-y-8 text-center max-w-3xl mx-auto">
              <div
                className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary"
                style={{ animation: "fadeInDown 0.6s ease both" }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                The digital HQ for African creators
              </div>

              <h1
                className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
                style={{ animation: "fadeInUp 0.7s ease 0.1s both" }}
              >
                Grow, Monetize &amp; Manage Your{" "}
                <span className="text-primary relative">
                  Creator Brand
                  <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-primary/30 rounded-full" />
                </span>{" "}
                in One Place.
              </h1>

              <p
                className="mx-auto max-w-[700px] text-muted-foreground md:text-xl leading-relaxed"
                style={{ animation: "fadeInUp 0.7s ease 0.2s both" }}
              >
                Everything you need to turn your audience into a business. Link-in-bio, digital store, content planner, and AI assistant — built for the next generation of African digital entrepreneurs.
              </p>

              <div
                className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
                style={{ animation: "fadeInUp 0.7s ease 0.3s both" }}
              >
                <Link href="/sign-up">
                  <Button size="lg" className="w-full sm:w-auto rounded-full text-base h-12 px-8 shadow-md hover:shadow-primary/25 hover:shadow-lg transition-shadow">
                    Start for free <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full text-base h-12 px-8">
                    Sign in
                  </Button>
                </Link>
              </div>

              {/* Stats row */}
              <div
                className="flex flex-wrap items-center justify-center gap-8 pt-4"
                style={{ animation: "fadeInUp 0.7s ease 0.4s both" }}
              >
                {[
                  { label: "Creators joined", value: "1,000+" },
                  { label: "Products sold", value: "500+" },
                  { label: "AI tools", value: "20+" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-2xl font-bold text-primary">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Dashboard Mockup Preview */}
              <div
                className="w-full max-w-2xl mx-auto mt-4 rounded-2xl border border-border bg-background/80 shadow-2xl shadow-primary/10 overflow-hidden"
                style={{ animation: "fadeInUp 0.8s ease 0.5s both" }}
              >
                {/* Window chrome */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-muted/40">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  <div className="flex-1 mx-3 h-5 rounded-md bg-muted text-[10px] flex items-center justify-center text-muted-foreground/60">creatorhub.app/dashboard</div>
                </div>
                {/* Dashboard content preview */}
                <div className="p-4 space-y-3 bg-background">
                  {/* Stat cards row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Wallet", val: "₦24,500", color: "text-green-500 bg-green-500/10" },
                      { label: "Sales", val: "12", color: "text-blue-500 bg-blue-500/10" },
                      { label: "Links", val: "8", color: "text-purple-500 bg-purple-500/10" },
                      { label: "AI Credits", val: "80", color: "text-primary bg-primary/10" },
                    ].map((c) => (
                      <div key={c.label} className={`rounded-xl p-2.5 ${c.color.split(" ")[1]}`}>
                        <p className="text-[10px] text-muted-foreground">{c.label}</p>
                        <p className={`text-sm font-bold ${c.color.split(" ")[0]}`}>{c.val}</p>
                      </div>
                    ))}
                  </div>
                  {/* Mini chart bar */}
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[10px] text-muted-foreground mb-2">Revenue this week</p>
                    <div className="flex items-end gap-1 h-10">
                      {[30, 55, 40, 80, 65, 90, 70].map((h, i) => (
                        <div key={i} className="flex-1 rounded-sm bg-primary/70 transition-all" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                  {/* Bottom row - product + AI */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border p-2.5 space-y-1.5">
                      <p className="text-[10px] font-medium">Recent Sale</p>
                      <p className="text-[10px] text-muted-foreground">Amaka bought <span className="font-semibold text-foreground">Branding Kit</span></p>
                      <p className="text-[10px] text-green-500 font-bold">+₦3,920</p>
                    </div>
                    <div className="rounded-xl border border-border p-2.5 space-y-1.5 bg-primary/5 border-primary/20">
                      <p className="text-[10px] font-medium flex items-center gap-1"><Sparkles className="h-2.5 w-2.5 text-primary" /> AI Assistant</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">Write me 5 viral hook ideas for my new course launch...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="w-full py-20 md:py-32 bg-muted/30 border-y border-border/50 flex justify-center">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
                <Globe className="mr-1.5 h-3.5 w-3.5" /> Everything in one platform
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Your complete creator toolkit</h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Replace 5 different subscriptions with one powerful platform designed specifically for your needs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature, i) => (
                <div
                  key={feature.title}
                  className="bg-background rounded-2xl p-7 shadow-sm border border-border transition-all duration-300 hover:shadow-md hover:border-primary/30 hover:-translate-y-1 group"
                  style={{ animation: `fadeInUp 0.6s ease ${0.05 * i}s both` }}
                >
                  <div className={`h-11 w-11 rounded-xl ${feature.bg} flex items-center justify-center ${feature.color} mb-5 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="w-full py-20 md:py-28 flex justify-center">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-14">
              <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
                <Users className="mr-1.5 h-3.5 w-3.5" /> Loved by creators
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What creators are saying</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { name: "Tolu Adesanya", handle: "@toludesigns", avatar: "TA", role: "Fashion & Lifestyle Creator · Lagos", text: "CreatorHub replaced three tools I was paying for separately. My link-in-bio, store, and AI caption writer all in one place — and I actually made money in my first week!" },
                { name: "Chidi Okonkwo", handle: "@chidifitness", avatar: "CO", role: "Fitness Coach · Abuja", text: "The AI content suite is insane. I generate a week's worth of content in under 30 minutes. And the Paystack integration just works — money lands in my wallet instantly.", featured: true },
                { name: "Amaka Nwosu", handle: "@amakacreates", avatar: "AN", role: "Digital Artist · Port Harcourt", text: "I sold 50 digital art packs in my first month. The checkout is smooth, buyers get their files instantly, and I track everything from one dashboard. Highly recommend!" },
              ].map((t) => (
                <div
                  key={t.name}
                  className={`rounded-2xl p-6 flex flex-col gap-4 ${t.featured ? "bg-primary/5 border-2 border-primary/20 shadow-lg shadow-primary/5" : "bg-background border border-border"}`}
                >
                  <p className="text-sm text-foreground/80 leading-relaxed flex-1">"{t.text}"</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${t.featured ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="w-full py-20 md:py-28 flex justify-center">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Get started in minutes</h2>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">No technical skills required. Set up your creator profile and start earning in under 5 minutes.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { step: "1", title: "Create your profile", desc: "Sign up and set up your link-in-bio page with your brand colors, bio, and links.", icon: Globe },
                { step: "2", title: "Add your products", desc: "Upload digital products, set prices, and publish your store. Paystack handles all payments.", icon: ShoppingBag },
                { step: "3", title: "Grow & earn", desc: "Share your link, attract visitors, earn from ads and sales, and withdraw to your bank.", icon: TrendingUp },
              ].map((item) => (
                <div key={item.step} className="text-center space-y-3">
                  <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto shadow-lg shadow-primary/20">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="w-full py-20 md:py-28 bg-muted/30 border-y border-border/50 flex justify-center">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-14">
              <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
                <Zap className="mr-1.5 h-3.5 w-3.5" /> Simple pricing
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Plans for every creator</h2>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Start free, upgrade when you're ready to scale.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl border-2 ${plan.color} bg-background p-7 flex flex-col ${plan.highlight ? "shadow-lg shadow-primary/10" : ""}`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black">{plan.price}</span>
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-2.5 flex-1 mb-7">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/sign-up">
                    <Button
                      className="w-full rounded-xl"
                      variant={plan.highlight ? "default" : "outline"}
                    >
                      Get started
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-24 flex justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/8 via-background to-background pointer-events-none" />
          <div className="container px-4 md:px-6 text-center relative z-10">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
              Ready to build your creator empire?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join African creators who are monetizing their audience, growing their brand, and making money online — with CreatorHub.
            </p>
            <Link href="/sign-up">
              <Button size="lg" className="rounded-full h-13 px-10 text-base shadow-lg hover:shadow-primary/25 transition-shadow">
                Start for free today <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="w-full py-8 md:py-12 border-t border-border bg-background flex justify-center">
        <div className="container px-4 md:px-6 flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="CreatorHub Logo" className="h-6 w-6 grayscale opacity-70" />
            <span className="font-semibold text-muted-foreground">CreatorHub</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/sign-up" className="hover:text-foreground transition-colors">Get Started</Link>
            <Link href="/sign-in" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} CreatorHub. All rights reserved. Made for African Creators.
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
