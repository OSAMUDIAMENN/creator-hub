import React, { useState } from "react";
import { Link } from "wouter";
import { useGetAiCredits, useGetSubscription } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Zap, Sparkles, Crown, Loader2, ArrowRight, RefreshCw, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const CREDIT_PACKS = [
  { id: "credits_50", label: "Starter Pack", credits: 50, price: 500, popular: false, desc: "Great for trying out AI tools" },
  { id: "credits_150", label: "Creator Pack", credits: 150, price: 1200, popular: true, desc: "Most popular for active creators" },
  { id: "credits_400", label: "Pro Pack", credits: 400, price: 2500, popular: false, desc: "For power users and heavy creators" },
  { id: "credits_1000", label: "Studio Pack", credits: 1000, price: 5000, popular: false, desc: "Unlimited creativity, full month" },
];

const AI_TOOLS = [
  { name: "Content Generator", cost: 1, icon: Sparkles, description: "Ideas, captions, hooks & hashtags" },
  { name: "Hook & Script Generator", cost: 2, icon: Zap, description: "Viral hooks and full scripts", proOnly: true },
  { name: "Thumbnail Analyzer", cost: 3, icon: Crown, description: "AI-powered thumbnail critique", proOnly: true },
  { name: "AI Chat", cost: 1, icon: Sparkles, description: "Creator assistant per message" },
  { name: "Trend Analyzer", cost: 2, icon: Zap, description: "Trending topics in your niche" },
];

export default function CreditsPage() {
  const { data: credits, isLoading: creditsLoading, refetch: refetchCredits } = useGetAiCredits();
  const { data: subscription } = useGetSubscription();
  const { toast } = useToast();
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      refetchCredits();
      toast({ title: "Credits added! 🎉", description: "Your AI credits have been topped up." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "failed") {
      toast({ title: "Payment failed", description: "Your credits were not added. Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const currentPlan = subscription?.plan ?? "free";
  const usedPct = credits && credits.totalCredits > 0
    ? Math.round((credits.usedCredits / credits.totalCredits) * 100)
    : 0;
  const barColor = usedPct >= 90 ? "bg-red-500" : usedPct >= 70 ? "bg-yellow-500" : "bg-primary";

  const handleBuyPack = async (pack: typeof CREDIT_PACKS[0]) => {
    setPurchasingPack(pack.id);
    try {
      const res = await fetch(`${BASE_URL}/api/paystack/credits/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
      setPurchasingPack(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Credits</h1>
        <p className="text-muted-foreground mt-1">
          Buy extra credits or upgrade your plan for more monthly allowance.
        </p>
      </div>

      {/* Current Balance */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          {creditsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Current Balance</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-primary">{credits?.remainingCredits ?? 0}</span>
                    <span className="text-muted-foreground text-lg">/ {credits?.totalCredits ?? 0}</span>
                    <span className="text-muted-foreground text-sm">credits remaining</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={currentPlan === "free" ? "secondary" : "default"} className="capitalize mb-1">
                    {currentPlan === "free" ? "Free" : currentPlan === "pro" ? "Creator Pro" : "Creator Business"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Resets monthly · {credits?.periodMonth}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <Progress value={usedPct} className="h-2.5" />
                <p className="text-xs text-muted-foreground">
                  {credits?.usedCredits ?? 0} used of {credits?.totalCredits ?? 0} this month
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Packs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Buy Extra Credits</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Credits never expire. Use them across all AI tools.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CREDIT_PACKS.map((pack) => (
            <Card
              key={pack.id}
              className={cn(
                "relative flex flex-col transition-all",
                pack.popular ? "border-primary ring-2 ring-primary/20" : "border-border"
              )}
            >
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3">Best Value</Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{pack.label}</CardTitle>
                <CardDescription className="text-xs">{pack.desc}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-2">
                <div className="flex items-baseline gap-1 mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-2xl font-bold">{pack.credits}</span>
                  <span className="text-sm text-muted-foreground">credits</span>
                </div>
                <p className="text-xl font-bold">₦{pack.price.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  ₦{(pack.price / pack.credits).toFixed(1)} / credit
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={pack.popular ? "default" : "outline"}
                  onClick={() => handleBuyPack(pack)}
                  disabled={!!purchasingPack}
                >
                  {purchasingPack === pack.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting...</>
                  ) : (
                    <>Buy {pack.credits} Credits</>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Credit Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credits Per Tool</CardTitle>
          <CardDescription>How many credits each AI tool consumes per use.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {AI_TOOLS.map((tool) => (
              <div key={tool.name} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <tool.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm flex items-center gap-2">
                      {tool.name}
                      {tool.proOnly && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Pro+</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{tool.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span>{tool.cost} credit{tool.cost > 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Banner */}
      {currentPlan === "free" && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div>
              <p className="font-bold text-base">Get 10× more credits every month</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upgrade to Creator Pro for 200 credits/mo + advanced AI tools for just ₦5,000/month.
              </p>
            </div>
            <Link href="/dashboard/pricing">
              <Button className="shrink-0">
                Upgrade <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Info className="h-4 w-4 shrink-0" />
        <span>Purchased credit packs are added on top of your monthly plan credits and never expire. Monthly plan credits reset at the start of each billing period.</span>
      </div>
    </div>
  );
}
