import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Link2,
  ShoppingBag,
  Calendar,
  Sparkles,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  Moon,
  Sun,
  Wallet,
  Wand2,
  Users,
  ShieldCheck,
  Share2,
  CreditCard,
  Zap,
  Crown,
  Building2,
  ChevronRight,
  X,
  Brain,
  Bot,
  Package,
  MessageSquare,
  Gift,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useGetProfile, useGetAiCredits, getGetProfileQueryKey } from "@workspace/api-client-react";
import { SubscriptionRenewalBanner } from "@/components/subscription-guard";
import { NotificationsBell } from "@/components/notifications-bell";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/links", icon: Link2, label: "Links" },
  { href: "/dashboard/store", icon: ShoppingBag, label: "Store" },
  { href: "/dashboard/planner", icon: Calendar, label: "Planner" },
  { href: "/dashboard/ai", icon: Sparkles, label: "AI Assistant" },
  { href: "/dashboard/ai-chat", icon: Bot, label: "AI Chat" },
  { href: "/dashboard/ai-tools", icon: Wand2, label: "AI Tools" },
  { href: "/dashboard/workspace", icon: Brain, label: "AI Workspace" },
  { href: "/dashboard/credits", icon: Zap, label: "AI Credits" },
  { href: "/dashboard/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/dashboard/wallet", icon: Wallet, label: "Wallet" },
  { href: "/dashboard/pricing", icon: CreditCard, label: "Pricing" },
  { href: "/dashboard/marketplace", icon: Package, label: "Marketplace" },
  { href: "/dashboard/teams", icon: Users, label: "Teams" },
  { href: "/dashboard/messaging", icon: MessageSquare, label: "Messaging" },
  { href: "/dashboard/social", icon: Share2, label: "Social Accounts" },
  { href: "/dashboard/referrals", icon: Gift, label: "Referrals & Earn" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  { href: "/dashboard/admin", icon: ShieldCheck, label: "Admin", adminOnly: true },
];

const BOTTOM_NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/dashboard/links", icon: Link2, label: "Links" },
  { href: "/dashboard/store", icon: ShoppingBag, label: "Store" },
  { href: "/dashboard/wallet", icon: Wallet, label: "Wallet" },
  { href: "/dashboard/analytics", icon: BarChart2, label: "Analytics" },
];

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Zap,
  pro: Crown,
  business: Building2,
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/15 text-primary",
  business: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function CreditsWidget() {
  const { data: credits } = useGetAiCredits();
  if (!credits) return null;
  const pct = credits.totalCredits > 0 ? Math.round((credits.usedCredits / credits.totalCredits) * 100) : 0;
  const isCritical = pct >= 85;
  return (
    <Link href="/dashboard/credits">
      <div className={cn(
        "mx-3 mb-2 rounded-lg p-3 border cursor-pointer transition-colors hover:bg-sidebar-accent/30",
        isCritical ? "border-red-500/30 bg-red-500/5" : "border-sidebar-border bg-sidebar-accent/10"
      )}>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold text-sidebar-foreground/80 flex items-center gap-1">
            <Zap className="h-3 w-3" /> AI Credits
          </span>
          <span className={cn("text-xs font-bold", isCritical ? "text-red-500" : "text-sidebar-foreground")}>
            {credits.remainingCredits}/{credits.totalCredits}
          </span>
        </div>
        <Progress
          value={pct}
          className={cn("h-1.5", isCritical ? "[&>div]:bg-red-500" : "")}
        />
        {isCritical && (
          <p className="text-[10px] text-red-500 mt-1 font-medium">Running low · Buy more</p>
        )}
      </div>
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: profile, isError, error } = useGetProfile();

  const { data: adminCheck } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => fetch("/api/admin/check").then((r) => r.json() as Promise<{ isAdmin: boolean }>),
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = adminCheck?.isAdmin ?? false;

  const { data: subData } = useQuery({
    queryKey: ["subscription-sidebar"],
    queryFn: () => fetch("/api/subscription", { credentials: "include" }).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const currentPlan: string = subData?.plan ?? "free";
  const PlanIcon = PLAN_ICONS[currentPlan] ?? Zap;

  useEffect(() => {
    if (isError && error && user) {
      fetch("/api/auth/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.fullName || user.firstName || "Creator",
          email: user.primaryEmailAddress?.emailAddress,
        }),
      }).then((res) => {
        if (res.ok) queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      });
    }
  }, [isError, error, user, queryClient]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground overflow-hidden">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border flex-shrink-0">
        <img src="/logo.svg" alt="CreatorHub Logo" className="h-8 w-8 mr-3" />
        <span className="font-bold text-lg tracking-tight">CreatorHub</span>
      </div>

      {/* Plan Badge */}
      <div className="px-4 py-3 flex-shrink-0">
        <Link href="/dashboard/pricing" onClick={onNavClick}>
          <div className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80",
            PLAN_COLORS[currentPlan] ?? PLAN_COLORS.free
          )}>
            <PlanIcon className="h-3.5 w-3.5" />
            <span className="capitalize">
              {currentPlan === "free" ? "Free Plan" : currentPlan === "pro" ? "Creator Pro" : "Creator Business"}
            </span>
            {currentPlan === "free" && (
              <span className="ml-auto opacity-60">Upgrade →</span>
            )}
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-2 overflow-y-auto">
        {NAV_ITEMS.filter((item) => !(item as any).adminOnly || isAdmin).map((item) => {
          const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={onNavClick}>
              <div
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  (item as any).adminOnly && "mt-2 border-t border-sidebar-border pt-3"
                )}
              >
                <item.icon className={cn("h-4 w-4 mr-3 flex-shrink-0 transition-transform", isActive && "scale-110")} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="h-3 w-3 opacity-50" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Credits Widget */}
      <CreditsWidget />

      {/* User Footer */}
      <div className="p-4 border-t border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-3 px-1">
          <Avatar className="h-9 w-9 border border-sidebar-border flex-shrink-0">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
              {user?.firstName?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <span className="text-sm font-semibold truncate leading-tight">{user?.fullName || "Creator"}</span>
            <span className="text-[11px] text-sidebar-foreground/50 truncate">
              {profile?.username ? `@${profile.username}` : user?.primaryEmailAddress?.emailAddress}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 h-8"
            onClick={() => signOut()}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign out
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-20 border-r border-border">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 md:pl-64 w-full h-full min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Logo" className="h-7 w-7" />
            <span className="font-bold text-base tracking-tight">CreatorHub</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[280px] border-r-0">
                <SidebarContent onNavClick={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Subscription renewal / past-due banner */}
        <SubscriptionRenewalBanner />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border flex items-stretch h-16">
          {BOTTOM_NAV.map((item) => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center justify-center h-full gap-1 px-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}>
                  <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                  <span className={cn("text-[10px] font-medium leading-none", isActive && "font-bold")}>{item.label}</span>
                  {isActive && <div className="absolute bottom-0 h-0.5 w-8 bg-primary rounded-t-full" />}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
