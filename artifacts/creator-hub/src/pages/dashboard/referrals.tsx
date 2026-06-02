import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Share2, Users, Wallet, Gift, CheckCircle, Clock, ArrowUpRight,
  Link2, TrendingUp, Star, ChevronRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
  return res.json();
}

type ReferralData = {
  code: string;
  referralLink: string;
  totalReferrals: number;
  convertedReferrals: number;
  totalEarned: number;
  pendingEarnings: number;
  referrals: {
    id: number;
    status: string;
    refereePlan: string | null;
    rewardAmount: number;
    createdAt: string;
    convertedAt: string | null;
  }[];
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Signed up", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Clock },
  converted: { label: "Upgraded", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: TrendingUp },
  rewarded: { label: "Rewarded", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle },
};

const PLAN_NAMES: Record<string, string> = { pro: "Creator Pro", business: "Creator Business" };

export default function ReferralsDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");

  const { data, isLoading } = useQuery<ReferralData>({
    queryKey: ["/referral"],
    queryFn: () => api("/referral"),
  });

  const applyMutation = useMutation({
    mutationFn: (code: string) => api("/referral/apply", { method: "POST", body: JSON.stringify({ code: code.trim().toUpperCase() }) }),
    onSuccess: () => {
      toast({ title: "Referral code applied! You'll earn rewards when they upgrade." });
      setApplyCode("");
      qc.invalidateQueries({ queryKey: ["/referral"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const copyLink = async () => {
    if (!data?.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    toast({ title: "Referral link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (!data?.referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join CreatorHub",
          text: "I've been using CreatorHub to grow my brand and earn money as a creator. Join me!",
          url: data.referralLink,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground mt-1">
          Share CreatorHub with other creators. Earn <span className="font-semibold text-foreground">₦980</span> when they go Pro or <span className="font-semibold text-foreground">₦1,980</span> when they go Business.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard icon={Users} label="Total Referrals" value={data?.totalReferrals ?? 0} color="text-blue-600" accent="border-l-blue-500" />
            <StatCard icon={TrendingUp} label="Converted" value={data?.convertedReferrals ?? 0} color="text-amber-600" accent="border-l-amber-500" />
            <StatCard icon={Wallet} label="Total Earned" value={`₦${(data?.totalEarned ?? 0).toLocaleString()}`} color="text-green-600" accent="border-l-green-500" />
            <StatCard icon={Gift} label="Pending" value={`₦${(data?.pendingEarnings ?? 0).toLocaleString()}`} color="text-purple-600" accent="border-l-purple-500" sub="Awaiting upgrades" />
          </>
        )}
      </div>

      {/* Referral Link Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share this link. When someone signs up and upgrades to a paid plan, you'll automatically earn your reward.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={data?.referralLink ?? ""}
                  readOnly
                  className="font-mono text-sm bg-background/80 flex-1"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="outline"
                  className={cn("shrink-0 transition-colors", copied && "border-green-500 text-green-600")}
                  onClick={copyLink}
                >
                  {copied ? <><CheckCircle className="h-4 w-4 mr-1.5" />Copied!</> : <><Copy className="h-4 w-4 mr-1.5" />Copy</>}
                </Button>
                <Button className="shrink-0" onClick={shareLink}>
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Share
                </Button>
              </div>

              <div className="flex items-center gap-3 bg-background/60 rounded-lg border px-4 py-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Star className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Your referral code</p>
                  <p className="text-lg font-bold font-mono tracking-widest text-primary">{data?.code ?? "—"}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Share your link", desc: "Share your unique referral link on social media, WhatsApp, or anywhere your audience is.", icon: Share2, color: "bg-blue-500" },
              { step: "2", title: "They sign up", desc: "Your friend or follower creates their CreatorHub account using your link.", icon: Users, color: "bg-purple-500" },
              { step: "3", title: "They upgrade & you earn", desc: "When they upgrade to Pro (₦980) or Business (₦1,980), the reward is credited to your wallet instantly.", icon: Gift, color: "bg-green-500" },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className={`h-9 w-9 rounded-xl ${item.color} flex items-center justify-center flex-shrink-0 text-white`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reward Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reward Rates</CardTitle>
          <CardDescription>You earn 20% of the first month's payment when your referee upgrades.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { plan: "Creator Pro", price: "₦4,900/mo", reward: "₦980", color: "border-primary/30 bg-primary/5", badge: "text-primary" },
              { plan: "Creator Business", price: "₦9,900/mo", reward: "₦1,980", color: "border-amber-500/30 bg-amber-500/5", badge: "text-amber-600" },
            ].map((item) => (
              <div key={item.plan} className={`flex items-center justify-between rounded-xl border p-4 ${item.color}`}>
                <div>
                  <p className={`font-bold text-sm ${item.badge}`}>{item.plan}</p>
                  <p className="text-xs text-muted-foreground">{item.price}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">You earn</p>
                  <p className={`text-xl font-bold ${item.badge}`}>{item.reward}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Referral History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Referral History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : !data?.referrals?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 opacity-20 mx-auto mb-3" />
              <p className="font-medium">No referrals yet</p>
              <p className="text-sm mt-1">Share your link to start earning rewards!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.referrals.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                const StatusIcon = meta.icon;
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                    <div className={cn("h-8 w-8 rounded-full border flex items-center justify-center flex-shrink-0", meta.color)}>
                      <StatusIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {r.status === "rewarded" || r.status === "converted"
                          ? `Upgraded to ${PLAN_NAMES[r.refereePlan ?? ""] ?? r.refereePlan ?? "a paid plan"}`
                          : "Signed up via your link"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.convertedAt
                          ? `Converted ${new Date(r.convertedAt).toLocaleDateString()}`
                          : `Signed up ${new Date(r.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs shrink-0", meta.color)}>{meta.label}</Badge>
                    {r.rewardAmount > 0 && (
                      <span className="text-sm font-bold text-green-600 shrink-0">+₦{r.rewardAmount.toLocaleString()}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply a code (for new users) */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Were you referred?</CardTitle>
          <CardDescription>If someone shared their referral code with you and you haven't applied it yet, enter it here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={applyCode}
              onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
              placeholder="e.g. JOHN1234-AB3CD"
              className="font-mono"
              maxLength={20}
            />
            <Button
              variant="outline"
              onClick={() => applyMutation.mutate(applyCode)}
              disabled={!applyCode.trim() || applyMutation.isPending}
            >
              {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Code"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, accent, sub }: {
  icon: React.ElementType; label: string; value: string | number; color?: string; accent?: string; sub?: string;
}) {
  return (
    <Card className={cn("border-l-4 transition-shadow hover:shadow-sm", accent ?? "border-l-border")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={cn("h-4 w-4", color ?? "text-muted-foreground")} />
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
