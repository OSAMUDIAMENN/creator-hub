import React from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetAnalyticsSummary,
  useListLinks,
  useGetAiCredits,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Link2,
  MousePointerClick,
  ShoppingBag,
  Wallet,
  Plus,
  Calendar,
  Sparkles,
  ArrowRight,
  Zap,
  Crown,
  Building2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardAdBanner } from "@/components/ui/dashboard-ad-banner";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const PLAN_META: Record<string, { label: string; icon: React.ElementType; color: string; badge: string }> = {
  free: { label: "Free Plan", icon: Zap, color: "text-muted-foreground", badge: "secondary" },
  pro: { label: "Creator Pro", icon: Crown, color: "text-primary", badge: "default" },
  business: { label: "Creator Business", icon: Building2, color: "text-amber-500", badge: "outline" },
};

export default function DashboardHome() {
  const { user } = useUser();
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetAnalyticsSummary();
  const { data: links, isLoading: isLoadingLinks } = useListLinks();
  const { data: credits, isLoading: creditsLoading } = useGetAiCredits();

  const { data: walletData } = useQuery({
    queryKey: ["wallet-summary"],
    queryFn: () =>
      fetch(`${BASE_URL}/api/wallet`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: subData } = useQuery({
    queryKey: ["subscription-home"],
    queryFn: () =>
      fetch(`${BASE_URL}/api/subscription`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const currentPlan: string = subData?.plan ?? "free";
  const planMeta = PLAN_META[currentPlan] ?? PLAN_META.free;
  const PlanIcon = planMeta.icon;

  const creditsPct =
    credits && credits.totalCredits > 0
      ? Math.round((credits.usedCredits / credits.totalCredits) * 100)
      : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {greeting}, {user?.firstName || "Creator"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your hub today.
          </p>
        </div>
        <Link href="/dashboard/pricing">
          <Badge
            variant="secondary"
            className={cn("hidden sm:flex items-center gap-1.5 cursor-pointer px-3 py-1.5 text-sm", planMeta.color)}
          >
            <PlanIcon className="h-3.5 w-3.5" />
            {planMeta.label}
          </Badge>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Link Clicks"
          value={analytics?.totalLinkClicks}
          icon={<MousePointerClick className="h-4 w-4 text-blue-500" />}
          isLoading={isLoadingAnalytics}
          iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Active Links"
          value={analytics?.activeLinks}
          icon={<Link2 className="h-4 w-4 text-green-500" />}
          isLoading={isLoadingAnalytics}
          iconBg="bg-green-500/10"
        />
        <StatCard
          title="Products"
          value={analytics?.totalProducts}
          icon={<ShoppingBag className="h-4 w-4 text-purple-500" />}
          isLoading={isLoadingAnalytics}
          iconBg="bg-purple-500/10"
        />
        <StatCard
          title="Balance"
          value={walletData?.balance != null ? `₦${Number(walletData.balance).toLocaleString()}` : "₦0"}
          icon={<Wallet className="h-4 w-4 text-orange-500" />}
          isLoading={false}
          iconBg="bg-orange-500/10"
        />
      </div>

      {/* Sponsored Ads */}
      <DashboardAdBanner count={2} layout="row" />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* AI Credits Card */}
        <Card className={cn(
          "border transition-colors",
          creditsPct >= 85 ? "border-red-500/30 bg-red-500/5" : "border-primary/20 bg-primary/5"
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                AI Credits
              </span>
              <Link href="/dashboard/credits">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Buy more <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creditsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{credits?.remainingCredits ?? 0}</span>
                  <span className="text-muted-foreground text-sm">/ {credits?.totalCredits ?? 0} remaining</span>
                </div>
                <Progress value={creditsPct} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {credits?.usedCredits ?? 0} used · resets monthly
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <QuickActionButton href="/dashboard/links" label="Add Link" icon={<Link2 className="h-4 w-4" />} />
            <QuickActionButton href="/dashboard/store" label="Add Product" icon={<ShoppingBag className="h-4 w-4" />} />
            <QuickActionButton href="/dashboard/planner" label="Schedule Post" icon={<Calendar className="h-4 w-4" />} />
            <QuickActionButton href="/dashboard/ai" label="Generate AI" icon={<Sparkles className="h-4 w-4" />} />
          </CardContent>
        </Card>

        {/* Revenue Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-green-600">
                ₦{walletData?.balance != null ? Number(walletData.balance).toLocaleString() : "0"}
              </p>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground border-t pt-3">
              <span>Total Earned</span>
              <span className="font-medium text-foreground">
                ₦{walletData?.totalEarned != null ? Number(walletData.totalEarned).toLocaleString() : "0"}
              </span>
            </div>
            <Link href="/dashboard/wallet">
              <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                View Wallet <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Links */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent Links</h2>
          <Link href="/dashboard/links">
            <Button variant="ghost" size="sm" className="text-muted-foreground h-8">
              View all <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {isLoadingLinks ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !links?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                <Link2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No links added yet.</p>
                <Link href="/dashboard/links">
                  <Button size="sm" className="mt-3" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> Add your first link
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {(Array.isArray(links) ? links : []).slice(0, 5).map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 truncate pr-4 min-w-0">
                      <p className="font-medium truncate text-sm">{link.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <MousePointerClick className="h-3.5 w-3.5" />
                      <span className="font-medium">{link.clicks}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  isLoading,
  iconBg = "bg-muted",
}: {
  title: string;
  value?: string | number;
  icon: React.ReactNode;
  isLoading: boolean;
  iconBg?: string;
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className={cn("p-1.5 rounded-md", iconBg)}>{icon}</div>
        </div>
        {isLoading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <p className="text-2xl font-bold">{value !== undefined ? value : 0}</p>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActionButton({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href}>
      <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted/60 hover:border-primary/30 transition-all text-left group">
        <span className="text-primary group-hover:scale-110 transition-transform">{icon}</span>
        {label}
      </button>
    </Link>
  );
}
