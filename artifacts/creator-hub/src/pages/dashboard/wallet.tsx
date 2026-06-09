import React, { useState } from "react";
import {
  useGetWallet,
  useListWithdrawals,
  useCreateWithdrawal,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  TrendingUp,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Banknote,
  ShoppingBag,
  ArrowUpRight,
  History,
  Megaphone,
  BarChart3,
  Download,
  Heart,
  Package,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardAdBanner } from "@/components/ui/dashboard-ad-banner";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
  processing: { label: "Processing", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Loader2 },
};

const TX_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  earning: { label: "Earning", color: "text-green-600" },
  withdrawal: { label: "Withdrawal", color: "text-red-500" },
  credit_purchase: { label: "Credits", color: "text-blue-500" },
  subscription: { label: "Subscription", color: "text-primary" },
};

const REVENUE_COLORS: Record<string, string> = {
  product_sales: "#f97316",
  ad_revenue: "#eab308",
  tips: "#ec4899",
  marketplace: "#8b5cf6",
};

const REVENUE_LABELS: Record<string, string> = {
  product_sales: "Product Sales",
  ad_revenue: "Ad Revenue",
  tips: "Tips",
  marketplace: "Marketplace",
};

function SimpleBarChart({ data, valueKey }: { data: Array<Record<string, any>>; valueKey: string }) {
  const max = Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  return (
    <div className="flex items-end gap-1.5 h-28 w-full">
      {data.map((d, i) => {
        const pct = Math.max((d[valueKey] ?? 0) / max, 0.02) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative group">
              <div
                className="w-full bg-primary/80 rounded-t-sm transition-all duration-300"
                style={{ height: `${pct * 0.88}px`, minHeight: 3, maxHeight: 96 }}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-popover border rounded text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                ₦{Number(d[valueKey] ?? 0).toLocaleString()}
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground leading-none text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  if (total === 0) return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No revenue yet</div>
  );

  let offset = 0;
  const slices = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .map(([key, val]) => {
      const pct = (val / total) * 100;
      const slice = { key, val, pct, offset };
      offset += pct;
      return slice;
    });

  const r = 40;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;

  function polarToCartesian(pct: number) {
    const angle = (pct / 100) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(startPct: number, endPct: number) {
    const s = polarToCartesian(startPct);
    const e = polarToCartesian(endPct);
    const large = endPct - startPct > 50 ? 1 : 0;
    return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
  }

  return (
    <div className="flex items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
        {slices.map((s) => (
          <path
            key={s.key}
            d={describeArc(s.offset, s.offset + s.pct)}
            fill={REVENUE_COLORS[s.key] ?? "#94a3b8"}
            opacity={0.85}
          />
        ))}
        <circle cx={cx} cy={cy} r={22} fill="white" className="dark:fill-background" />
      </svg>
      <div className="space-y-1.5 min-w-0">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: REVENUE_COLORS[s.key] ?? "#94a3b8" }} />
            <span className="text-muted-foreground truncate">{REVENUE_LABELS[s.key] ?? s.key}</span>
            <span className="font-medium ml-auto pl-2">₦{Number(s.val).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WalletPage() {
  const { data: wallet, isLoading: walletLoading } = useGetWallet();
  const { data: withdrawals, isLoading: withdrawalsLoading } = useListWithdrawals();
  const createWithdrawal = useCreateWithdrawal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () =>
      fetch(`${BASE_URL}/api/transactions`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: adEarnings, isLoading: adEarningsLoading } = useQuery({
    queryKey: ["adEarnings"],
    queryFn: () =>
      fetch(`${BASE_URL}/api/ads/earnings`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["revenueAnalytics"],
    queryFn: () =>
      fetch(`${BASE_URL}/api/revenue/analytics`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: tips, isLoading: tipsLoading } = useQuery({
    queryKey: ["tipsReceived"],
    queryFn: () =>
      fetch(`${BASE_URL}/api/tips/received`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: tipStats } = useQuery({
    queryKey: ["tipStats"],
    queryFn: () =>
      fetch(`${BASE_URL}/api/tips/stats`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [accountDetails, setAccountDetails] = useState("");

  const handleWithdraw = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 1000) {
      toast({ title: "Minimum withdrawal is ₦1,000", variant: "destructive" });
      return;
    }
    if (!accountDetails.trim()) {
      toast({ title: "Please enter account details", variant: "destructive" });
      return;
    }
    createWithdrawal.mutate(
      { data: { amount: numAmount, paymentMethod, accountDetails } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setWithdrawOpen(false);
          setAmount("");
          setAccountDetails("");
          toast({
            title: "Withdrawal request submitted!",
            description: "We'll process it within 1–3 business days.",
          });
        },
        onError: (err: any) => {
          toast({
            title: "Withdrawal failed",
            description: err?.response?.data?.error ?? "Please try again",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleExportReport = () => {
    const from = new Date(Date.now() - 90 * 86400_000).toISOString().split("T")[0];
    const to = new Date().toISOString().split("T")[0];
    window.open(`${BASE_URL}/api/revenue/earnings-report?from=${from}&to=${to}`, "_blank");
  };

  const canWithdraw = wallet && (wallet.balance ?? 0) >= 1000;

  const revenueBreakdown = analytics?.revenueBreakdown ?? {};
  const monthlyEarnings = analytics?.monthlyEarnings ?? [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Wallet & Earnings</h1>
          <p className="text-muted-foreground mt-1">Track your earnings and request withdrawals.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportReport} className="hidden sm:flex">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setWithdrawOpen(true)} disabled={!canWithdraw}>
            <ArrowDownCircle className="h-4 w-4 mr-2" />
            Withdraw
          </Button>
        </div>
      </div>

      <DashboardAdBanner count={1} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wider font-medium">
              <Wallet className="h-4 w-4" /> Available Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {walletLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <div>
                <p className="text-3xl font-bold text-primary">
                  ₦{Number(wallet?.balance ?? 0).toLocaleString()}
                </p>
                {!canWithdraw && (
                  <p className="text-xs text-muted-foreground mt-1">Min ₦1,000 to withdraw</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wider font-medium">
              <TrendingUp className="h-4 w-4" /> Total Earned
            </CardDescription>
          </CardHeader>
          <CardContent>
            {walletLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <p className="text-3xl font-bold text-green-600">
                ₦{Number(wallet?.totalEarned ?? 0).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wider font-medium">
              <Banknote className="h-4 w-4" /> Total Withdrawn
            </CardDescription>
          </CardHeader>
          <CardContent>
            {walletLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <p className="text-3xl font-bold text-muted-foreground">
                ₦{Number(wallet?.totalWithdrawn ?? 0).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Monthly Earnings
              </CardTitle>
              <span className="text-xs text-muted-foreground">Last 6 months</span>
            </div>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : monthlyEarnings.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-muted-foreground text-sm">No earnings yet</div>
            ) : (
              <SimpleBarChart data={monthlyEarnings} valueKey="total" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Revenue Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <DonutChart breakdown={revenueBreakdown} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Ad Earnings */}
        <Card className="border-dashed border-2 border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wider font-medium">
                <Megaphone className="h-4 w-4 text-yellow-500" /> Ad Earnings
              </CardDescription>
              {adEarnings && (
                <span className="text-xs text-muted-foreground">
                  {adEarnings.totalImpressions ?? 0} impressions
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {adEarningsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  ₦{Number((adEarnings?.totalEarningsKobo ?? 0) / 100).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">From sponsored ads</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips Received */}
        <Card className="border-dashed border-2 border-pink-500/30 bg-pink-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wider font-medium">
              <Heart className="h-4 w-4 text-pink-500" /> Tips Received
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-2xl font-bold text-pink-600">
                ₦{Number(tipStats?.totalAmount ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {tipStats?.totalTips ?? 0} tip{tipStats?.totalTips !== 1 ? "s" : ""} from {tipStats?.uniqueTippers ?? 0} supporter{tipStats?.uniqueTippers !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Marketplace Orders */}
        <Card className="border-dashed border-2 border-purple-500/30 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wider font-medium">
              <Package className="h-4 w-4 text-purple-500" /> Marketplace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-2xl font-bold text-purple-600">
                ₦{Number(revenueBreakdown.marketplace ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">From service orders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Transactions + Withdrawals + Tips */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions" className="gap-2">
            <History className="h-4 w-4" /> Transactions
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-2">
            <ArrowDownCircle className="h-4 w-4" /> Withdrawals
          </TabsTrigger>
          <TabsTrigger value="tips" className="gap-2">
            <Heart className="h-4 w-4" /> Tips
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transaction History</CardTitle>
              <CardDescription>Your full earnings and payment history.</CardDescription>
            </CardHeader>
            <CardContent>
              {txLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !transactions?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No transactions yet</p>
                  <p className="text-sm opacity-70 mt-1">Earnings from product sales will appear here.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {(transactions as any[]).map((tx: any) => {
                    const cfg = TX_TYPE_CONFIG[tx.type] ?? { label: tx.type, color: "text-foreground" };
                    const isEarning = tx.type === "earning";
                    return (
                      <div key={tx.id} className="py-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "p-2 rounded-full shrink-0",
                            isEarning ? "bg-green-500/10" : "bg-muted"
                          )}>
                            {isEarning
                              ? <ArrowUpRight className="h-4 w-4 text-green-600" />
                              : <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{tx.description || cfg.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString("en-NG", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn("font-bold text-sm", isEarning ? "text-green-600" : "text-foreground")}>
                            {isEarning ? "+" : ""}₦{Number(tx.amount).toLocaleString()}
                          </p>
                          <Badge
                            variant="secondary"
                            className={cn("text-[10px] mt-0.5",
                              tx.status === "completed" ? "text-green-600 bg-green-500/10" : ""
                            )}
                          >
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Withdrawal History</CardTitle>
              <CardDescription>All your withdrawal requests and their status.</CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawalsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !withdrawals?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Banknote className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No withdrawals yet</p>
                  <p className="text-sm opacity-70 mt-1">Earn from product sales, then withdraw to your account.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {(withdrawals as any[]).map((w: any) => {
                    const cfg = STATUS_CONFIG[w.status] ?? STATUS_CONFIG.pending;
                    const Icon = cfg.icon;
                    return (
                      <div key={w.id} className="py-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-full border shrink-0", cfg.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">₦{Number(w.amount ?? 0).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              via {w.paymentMethod?.replace("_", " ")} ·{" "}
                              {new Date(w.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge className={cn("border text-xs shrink-0", cfg.color)}>{cfg.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tips" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Tips Received</CardTitle>
                  <CardDescription>Support from your fans and followers.</CardDescription>
                </div>
                {tipStats?.totalTips > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-pink-600">₦{Number(tipStats.totalAmount ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{tipStats.totalTips} tips</p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {tipsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !tips?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No tips yet</p>
                  <p className="text-sm opacity-70 mt-1">Share your profile link to start receiving tips from fans.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {(tips as any[]).map((tip: any) => (
                    <div key={tip.id} className="py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-full bg-pink-500/10 shrink-0">
                          <Heart className="h-4 w-4 text-pink-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">
                            {tip.isAnonymous ? "Anonymous" : (tip.tipperName ?? "Anonymous")}
                          </p>
                          {tip.message && (
                            <p className="text-xs text-muted-foreground truncate italic">"{tip.message}"</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {new Date(tip.createdAt).toLocaleDateString("en-NG", {
                              day: "numeric", month: "short", year: "numeric"
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm text-pink-600">
                          +₦{Number(tip.amount).toLocaleString()}
                        </p>
                        <Badge variant="secondary" className={cn("text-[10px] mt-0.5", tip.status === "completed" ? "text-green-600 bg-green-500/10" : "")}>
                          {tip.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              Available balance:{" "}
              <span className="font-bold text-primary">₦{Number(wallet?.balance ?? 0).toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                placeholder="Min ₦1,000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paystack">Paystack</SelectItem>
                  <SelectItem value="opay">OPay</SelectItem>
                  <SelectItem value="palmpay">PalmPay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account Details</Label>
              <Input
                placeholder="Account number, bank name, or phone"
                value={accountDetails}
                onChange={(e) => setAccountDetails(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleWithdraw} disabled={createWithdrawal.isPending}>
              {createWithdrawal.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
