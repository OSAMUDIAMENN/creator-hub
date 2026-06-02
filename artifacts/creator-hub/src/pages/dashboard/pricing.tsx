import React, { useEffect } from "react";
import { useGetSubscription, useListPlans } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Building2, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Zap,
  pro: Crown,
  business: Building2,
};

const PLAN_COLORS: Record<string, string> = {
  free: "border-border",
  pro: "border-primary ring-2 ring-primary/20",
  business: "border-amber-500 ring-2 ring-amber-500/20",
};

export default function PricingPage() {
  const { data: subscription, isLoading: subLoading, refetch: refetchSub } = useGetSubscription();
  const { data: plans, isLoading: plansLoading } = useListPlans();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const [upgradingPlan, setUpgradingPlan] = React.useState<string | null>(null);

  const currentPlan = subscription?.plan ?? "free";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      toast({ title: "Payment successful!", description: "Your plan has been upgraded." });
      queryClient.invalidateQueries();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (payment === "failed") {
      toast({ title: "Payment failed or cancelled", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan || planId === "free") return;
    setUpgradingPlan(planId);
    try {
      const res = await fetch(`${BASE_URL}/api/paystack/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initialize payment");
      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      toast({ title: "Could not start payment", description: err.message, variant: "destructive" });
      setUpgradingPlan(null);
    }
  };

  const isLoading = subLoading || plansLoading;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Plans & Pricing</h1>
        <p className="text-muted-foreground mt-1">
          Choose the plan that's right for your creator journey.
        </p>
      </div>

      {subscription && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Current plan: <span className="text-primary capitalize">{currentPlan}</span></p>
            <p className="text-sm text-muted-foreground">
              {subscription.currentPeriodEnd
                ? `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : "Free forever"}
            </p>
          </div>
          <Badge variant={currentPlan === "free" ? "secondary" : "default"} className="capitalize">
            {currentPlan}
          </Badge>
        </div>
      )}

      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-6 bg-muted rounded w-24" /></CardHeader>
              <CardContent><div className="h-32 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {(plans ?? []).map((plan: any) => {
            const Icon = PLAN_ICONS[plan.id] ?? Zap;
            const isCurrent = currentPlan === plan.id;
            const isUpgrade =
              plan.id !== "free" &&
              (currentPlan === "free" || (plan.id === "business" && currentPlan === "pro"));
            const isPending = upgradingPlan === plan.id;

            return (
              <Card
                key={plan.id}
                className={cn("relative flex flex-col transition-all", PLAN_COLORS[plan.id] ?? "border-border")}
              >
                {plan.id === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {plan.price === 0 ? "Free" : `₦${plan.price.toLocaleString()}`}
                    </span>
                    {plan.price > 0 && <span className="text-muted-foreground">/mo</span>}
                  </div>
                  <CardDescription>{plan.aiCredits} AI credits/month</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2">
                    {plan.features.map((feature: string) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : plan.id === "pro" ? "default" : "outline"}
                    disabled={isCurrent || plan.id === "free" || !!upgradingPlan}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting to Paystack...</>
                    ) : isCurrent ? (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Current Plan</>
                    ) : plan.id === "free" ? (
                      "Free Forever"
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-6 text-center">
        <p className="text-sm text-muted-foreground">
          All plans include SSL security, custom domain support, and 24/7 uptime.{" "}
          <span className="text-primary font-medium">Payments securely processed via Paystack (NGN).</span>
        </p>
      </div>
    </div>
  );
}
