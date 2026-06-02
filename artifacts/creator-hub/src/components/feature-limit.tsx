import { Link } from "wouter";
import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";

interface FreemiumGateProps {
  feature: string;
  freeLimit: number;
  currentCount: number;
  children: React.ReactNode;
  proFeatures?: string[];
}

export function FreemiumGate({ feature, freeLimit, currentCount, children, proFeatures }: FreemiumGateProps) {
  const { effectivePlan } = useSubscription();
  const isAtLimit = effectivePlan === "free" && currentCount >= freeLimit;

  return (
    <div>
      {children}
      {isAtLimit && (
        <div className="mt-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
          <Crown className="h-6 w-6 text-primary mx-auto mb-2" />
          <p className="text-sm font-semibold mb-1">
            You've reached your free limit ({freeLimit} {feature})
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Upgrade to Creator Pro for unlimited {feature}
            {proFeatures && proFeatures.length > 0 && `, ${proFeatures.join(", ")}`}.
          </p>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/dashboard/pricing">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Upgrade to Pro
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

interface FeatureUsageBadgeProps {
  current: number;
  limit: number;
  label: string;
}

export function FeatureUsageBadge({ current, limit, label }: FeatureUsageBadgeProps) {
  const { effectivePlan } = useSubscription();
  if (effectivePlan !== "free") return null;
  const pct = (current / limit) * 100;
  const isNear = pct >= 80;
  const isAt = current >= limit;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
        isAt
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : isNear
          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
          : "bg-muted text-muted-foreground border-border"
      }`}
    >
      {current}/{limit} {label}
    </span>
  );
}

interface UpgradeInlineBannerProps {
  title: string;
  description: string;
  compact?: boolean;
}

export function UpgradeInlineBanner({ title, description, compact = false }: UpgradeInlineBannerProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Crown className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{description}</span>
        </div>
        <Button asChild size="sm" variant="outline" className="flex-shrink-0 h-7 text-xs rounded-full border-primary/30 text-primary hover:bg-primary/10">
          <Link href="/dashboard/pricing">Upgrade</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 text-center space-y-3">
      <div className="flex items-center justify-center gap-2">
        <Crown className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Button asChild size="sm" className="rounded-full">
        <Link href="/dashboard/pricing">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Upgrade to Pro
        </Link>
      </Button>
    </div>
  );
}
