import { Link } from "wouter";
import { AlertTriangle, Lock, RefreshCw, Crown, Building2, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSubscription, type Plan } from "@/hooks/use-subscription";

const PLAN_META: Record<Plan, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  free: { label: "Free", icon: Zap, color: "text-muted-foreground", bg: "bg-muted" },
  pro: { label: "Creator Pro", icon: Crown, color: "text-primary", bg: "bg-primary/10" },
  business: { label: "Creator Business", icon: Building2, color: "text-amber-500", bg: "bg-amber-500/10" },
};

const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [],
  pro: [
    "Unlimited AI chat with memory",
    "AI content tools (hooks, scripts, trends)",
    "Content planner & scheduler",
    "AI Workspace to save generations",
    "Social accounts management",
    "Advanced analytics",
  ],
  business: [
    "Everything in Creator Pro",
    "Team collaboration (up to 10 members)",
    "Priority support",
    "Custom integrations",
  ],
};

interface SubscriptionGuardProps {
  requiredPlan: Plan;
  children: React.ReactNode;
}

/**
 * Freemium guard — free users see the page with an upgrade banner at top.
 * Hard blocks only for past_due / expired subscriptions.
 */
export function SubscriptionGuard({ requiredPlan, children }: SubscriptionGuardProps) {
  const { hasPlan, isLoading, effectivePlan, plan, isPastDue, isExpired } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasPlan(requiredPlan)) return <>{children}</>;

  const wasOnPaidPlan = plan !== "free";
  const needsRenewal = wasOnPaidPlan && (isPastDue || isExpired);

  if (needsRenewal) {
    const planMeta = PLAN_META[plan as Plan] ?? PLAN_META.free;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md border-2 border-dashed">
          <CardContent className="pt-10 pb-8 flex flex-col items-center text-center gap-4">
            <div className="rounded-full p-4 bg-muted">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Subscription paused</h2>
              <p className="text-sm text-muted-foreground">
                Your{" "}
                <span className={`font-semibold ${planMeta.color}`}>{planMeta.label}</span>{" "}
                subscription has {isPastDue ? "a failed payment" : "expired"}.
                Renew to regain access to this feature.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button asChild className="w-full">
                <Link href="/dashboard/pricing">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Renew subscription
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const required = PLAN_META[requiredPlan];
  const RequiredIcon = required.icon;
  const features = PLAN_FEATURES[requiredPlan];

  return (
    <>
      <div className={`rounded-xl border-2 border-dashed p-5 mb-6 ${required.bg} border-current/20 animate-in fade-in duration-300`}>
        <div className="flex items-start gap-4">
          <div className={`rounded-full p-2.5 ${required.bg} flex-shrink-0`}>
            <RequiredIcon className={`h-5 w-5 ${required.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-bold text-base ${required.color}`}>
                {required.label} feature
              </h3>
              <span className="text-xs bg-background border rounded-full px-2 py-0.5 text-muted-foreground font-medium capitalize">
                You're on {effectivePlan} plan
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Upgrade to <span className={`font-semibold ${required.color}`}>{required.label}</span> to unlock full access. You can explore below with limited functionality.
            </p>
            {features.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <Sparkles className={`h-3 w-3 flex-shrink-0 ${required.color}`} />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" asChild>
              <Link href="/dashboard/pricing">
                <RequiredIcon className="h-3.5 w-3.5 mr-1.5" />
                Upgrade to {required.label}
              </Link>
            </Button>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}

/**
 * Inline banner shown at the top of the dashboard when a paid subscription
 * needs attention (past_due or expired). Renders nothing for healthy plans.
 */
export function SubscriptionRenewalBanner() {
  const { plan, isPastDue, isExpired, isCancelling, currentPeriodEnd, isLoading } = useSubscription();

  if (isLoading || plan === "free") return null;
  if (!isPastDue && !isExpired && !isCancelling) return null;

  const formattedEnd = currentPeriodEnd
    ? currentPeriodEnd.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    : null;

  if (isCancelling && !isPastDue && !isExpired) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Your subscription will cancel on{" "}
          <span className="font-semibold">{formattedEnd ?? "your billing date"}</span>.
          You'll keep access until then.
        </p>
        <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900 flex-shrink-0" asChild>
          <Link href="/dashboard/pricing">Keep subscription</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        {isPastDue
          ? "Your last payment failed — some features are paused."
          : `Your subscription expired on ${formattedEnd ?? "your billing date"}.`}
      </p>
      <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0" asChild>
        <Link href="/dashboard/pricing">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Renew now
        </Link>
      </Button>
    </div>
  );
}
