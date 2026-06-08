import React, { useState, useEffect, useRef } from "react";
import { FeatureFlagsTab, MenuBuilderTab, CmsTab, AuditLogsTab, WalletMgmtTab, SecurityTab } from "./admin-super";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Users, DollarSign, Zap, CreditCard, CheckCircle, XCircle, Loader2, ShieldCheck,
  Search, Crown, Building2, RefreshCw, BarChart2, Settings, Megaphone, Eye, EyeOff,
  Trash2, Ban, UserCheck, TrendingUp, Package, AlertTriangle, Globe, Image,
  ArrowUpRight, Wallet, Activity, HardDrive, Plus, Edit, ToggleLeft, ToggleRight,
  ArrowDownCircle, Bell, Send, Upload, Link2,
  Menu, FileText, ClipboardList, WalletCards, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? "Request failed");
  if (res.status === 204) return undefined as T;
  return res.json();
}

type AdminStats = {
  totalUsers: number; newUsersThisMonth: number; activeSubscriptions: number;
  proSubscriptions: number; businessSubscriptions: number;
  pendingWithdrawals: number; pendingWithdrawalsAmount: number;
  totalAiCreditsUsed: number; totalEarned: number; totalWithdrawn: number;
  suspendedUsers: number; totalCompletedTransactions: number;
  totalTransactionVolume: number; activeAds: number;
};
type Revenue = {
  subscriptionRevenue: number; proSubscribers: number; businessSubscribers: number;
  totalWithdrawn: number; approvedWithdrawals: number; pendingWithdrawals: number;
  activeMarketplaceListings: number; profit: number; totalPlatformEarned: number;
};
type AdminUser = {
  id: number; name: string; username: string; email: string; role: string; isAdmin: boolean;
  isSuspended: boolean; plan: string; subStatus: string; balance: number; totalEarned: number;
  pendingWithdrawalsAmount: number; createdAt: string;
};
type Withdrawal = {
  id: number; userId: number; amount: number; currency: string; status: string; paymentMethod: string;
  accountDetails: string; adminNotes: string | null; processedAt: string | null; createdAt: string;
  userName: string; userEmail: string; userUsername: string;
};
type Ad = {
  id: number; title: string; description: string | null; imageUrl: string | null; ctaUrl: string;
  ctaText: string; advertiserName: string; isActive: boolean; earningsPerImpression: number; createdAt: string;
};
type Analytics = {
  totalUsers: number; activeUsers30d: number; activeUsers7d: number; totalUploads: number;
  totalStorageBytes: number; totalAiCalls: number; totalAiCreditsUsed: number;
  totalMarketplaceListings: number; aiByTool: { tool: string; credits: number; calls: number }[];
};
type Upload = { id: number; fileName: string; originalName: string; fileUrl: string; fileType: string; fileSize: number; folder: string; createdAt: string; userName: string; userEmail: string; };
type MarketplaceRow = { id: number; title: string; category: string; serviceType: string; price: number; isActive: boolean; totalOrders: number; createdAt: string; sellerName: string; sellerEmail: string; };
type PlatformSettings = Record<string, string>;

const PLAN_COLORS: Record<string, string> = { free: "secondary", pro: "default", business: "default" };
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  processing: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

function StatCard({ icon: Icon, label, value, sub, color, trend, accent }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string; trend?: string; accent?: string }) {
  return (
    <Card className={cn("relative overflow-hidden transition-shadow hover:shadow-md", accent && `border-l-4 ${accent}`)}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
          <Icon className={`h-4 w-4 ${color ?? "text-muted-foreground"}`} />
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {trend && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />{trend}</p>}
      </CardContent>
    </Card>
  );
}

function fmt(n: number) { return n.toLocaleString("en-NG"); }
function fmtNGN(n: number) { return `₦${fmt(n)}`; }
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

type ChartDay = { date: string; signups: number; revenue: number };

function fmtShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function RevenueChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name === "revenue" ? fmtNGN(p.value) : `${p.value} signups`}
        </p>
      ))}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ stats }: { stats: AdminStats | undefined }) {
  const qc = useQueryClient();
  const [chartRange, setChartRange] = useState<7 | 30 | 90>(30);

  const { data: chartData = [], isLoading: chartLoading } = useQuery<ChartDay[]>({
    queryKey: ["/admin/revenue-chart", chartRange],
    queryFn: () => api(`/admin/revenue-chart?days=${chartRange}`),
  });

  const formattedChart = chartData.map((d) => ({
    ...d,
    date: fmtShortDate(d.date),
    revenue: Number(d.revenue),
  }));

  if (!stats) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(10)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Platform Overview</h3>
        <Button variant="ghost" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ["/admin/stats"] }); qc.invalidateQueries({ queryKey: ["/admin/revenue-chart"] }); }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={fmt(stats.totalUsers)} sub={`+${stats.newUsersThisMonth} this month`} trend={`${stats.newUsersThisMonth} new`} accent="border-l-blue-500" />
        <StatCard icon={CreditCard} label="Active Subs" value={fmt(stats.activeSubscriptions)} sub={`${stats.proSubscriptions} Pro · ${stats.businessSubscriptions} Business`} color="text-primary" accent="border-l-primary" />
        <StatCard icon={Wallet} label="Total Earned" value={fmtNGN(stats.totalEarned)} sub={`${fmtNGN(stats.totalWithdrawn)} withdrawn`} color="text-green-600" accent="border-l-green-500" />
        <StatCard icon={ArrowDownCircle} label="Pending Payouts" value={fmt(stats.pendingWithdrawals)} sub={fmtNGN(stats.pendingWithdrawalsAmount)} color="text-amber-600" accent="border-l-amber-500" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Zap} label="AI Credits Used" value={fmt(stats.totalAiCreditsUsed)} color="text-purple-600" accent="border-l-purple-500" />
        <StatCard icon={Ban} label="Suspended Users" value={fmt(stats.suspendedUsers)} color="text-red-500" accent="border-l-red-400" />
        <StatCard icon={Crown} label="Pro Subscribers" value={fmt(stats.proSubscriptions)} color="text-primary" />
        <StatCard icon={Building2} label="Business Subs" value={fmt(stats.businessSubscriptions)} color="text-amber-500" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Completed Transactions" value={fmt(stats.totalCompletedTransactions)} color="text-blue-600" />
        <StatCard icon={DollarSign} label="Transaction Volume" value={fmtNGN(stats.totalTransactionVolume)} color="text-green-600" />
        <StatCard icon={Megaphone} label="Active Ads" value={fmt(stats.activeAds)} color="text-orange-500" />
      </div>

      {/* Revenue & Signups Chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm">Revenue & Signups Trend</CardTitle>
              <CardDescription className="text-xs">Daily completed transaction revenue and new user signups</CardDescription>
            </div>
            <div className="flex gap-1">
              {([7, 30, 90] as const).map((d) => (
                <Button key={d} variant={chartRange === d ? "default" : "outline"} size="sm" className="h-7 text-xs px-2.5" onClick={() => setChartRange(d)}>
                  {d}d
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={formattedChart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="signupsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={chartRange === 7 ? 0 : chartRange === 30 ? 4 : 9}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="left"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`}
                  width={52}
                />
                <YAxis
                  yAxisId="signups"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip content={<RevenueChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#revenueGrad)" name="revenue" dot={false} activeDot={{ r: 4 }} />
                <Area yAxisId="signups" type="monotone" dataKey="signups" stroke="#3b82f6" strokeWidth={2} fill="url(#signupsGrad)" name="signups" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Subscription Mix</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Free users", value: stats.totalUsers - stats.activeSubscriptions, total: stats.totalUsers, color: "bg-muted-foreground/30" },
              { label: "Pro subscribers", value: stats.proSubscriptions, total: stats.totalUsers, color: "bg-primary" },
              { label: "Business subscribers", value: stats.businessSubscriptions, total: stats.totalUsers, color: "bg-amber-500" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{fmt(item.value)}</span>
                </div>
                <Progress value={item.total > 0 ? (item.value / item.total) * 100 : 0} className={cn("h-1.5 [&>div]:", item.color)} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Wallet Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Total earned by creators", value: stats.totalEarned, color: "bg-green-500" },
              { label: "Total withdrawn", value: stats.totalWithdrawn, color: "bg-blue-500" },
              { label: "Pending withdrawals", value: stats.pendingWithdrawalsAmount, color: "bg-amber-500" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{fmtNGN(item.value)}</span>
                </div>
                <Progress value={stats.totalEarned > 0 ? (item.value / stats.totalEarned) * 100 : 0} className={cn("h-1.5 [&>div]:", item.color)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [overrideTarget, setOverrideTarget] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/admin/users"],
    queryFn: () => api("/admin/users?limit=200"),
  });

  const patchUser = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      api(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/users"] }); qc.invalidateQueries({ queryKey: ["/admin/stats"] }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/users"] }); toast({ title: "User deleted" }); setConfirmDelete(null); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = users.filter((u) => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or username..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Pending Payout</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id} className={u.isSuspended ? "opacity-60 bg-red-500/5" : ""}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{u.name}</p>
                          <p className="text-xs text-muted-foreground">@{u.username}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={PLAN_COLORS[u.plan] as any ?? "secondary"} className="capitalize text-xs">{u.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select value={u.role} onValueChange={(role) => patchUser.mutate({ id: u.id, updates: { role } })}>
                          <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="creator">Creator</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{fmtNGN(u.balance)}</TableCell>
                      <TableCell className="text-sm">
                        {u.pendingWithdrawalsAmount > 0 ? (
                          <span className="text-amber-600 font-semibold">{fmtNGN(u.pendingWithdrawalsAmount)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.isSuspended
                          ? <Badge variant="destructive" className="text-xs">Suspended</Badge>
                          : u.isAdmin
                            ? <Badge className="text-xs bg-primary/10 text-primary">Admin</Badge>
                            : <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">Active</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => setOverrideTarget(u)}>
                            <CreditCard className="h-3 w-3 mr-1" /> Plan
                          </Button>
                          <Button size="sm" variant="outline" className={cn("text-xs h-7", u.isSuspended ? "text-green-600" : "text-amber-600")}
                            onClick={() => patchUser.mutate({ id: u.id, updates: { isSuspended: !u.isSuspended } })}>
                            {u.isSuspended ? <><UserCheck className="h-3 w-3 mr-1" />Restore</> : <><Ban className="h-3 w-3 mr-1" />Suspend</>}
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 text-destructive"
                            onClick={() => setConfirmDelete(u)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SubscriptionOverrideDialog target={overrideTarget} onClose={() => setOverrideTarget(null)} onSuccess={() => { setOverrideTarget(null); qc.invalidateQueries({ queryKey: ["/admin/users"] }); }} />

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Account</DialogTitle>
            <DialogDescription>This will permanently delete <strong>{confirmDelete?.name}</strong>'s account and all their data. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteUser.mutate(confirmDelete.id)} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubscriptionOverrideDialog({ target, onClose, onSuccess }: { target: AdminUser | null; onClose: () => void; onSuccess: () => void }) {
  const [plan, setPlan] = useState(target?.plan ?? "free");
  const [periodDays, setPeriodDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (target) { setPlan(target.plan); setPeriodDays("30"); } }, [target]);

  const handleSave = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await api(`/admin/users/${target.id}/subscription`, { method: "POST", body: JSON.stringify({ plan, periodDays: parseInt(periodDays, 10) || 30, status: "active" }) });
      toast({ title: "Subscription updated", description: `${target.name} is now on the ${plan} plan.` });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Override Subscription</DialogTitle>
          <DialogDescription>Manually set plan for <span className="font-semibold text-foreground">{target?.name}</span>.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-muted-foreground" /> Free</div></SelectItem>
                <SelectItem value="pro"><div className="flex items-center gap-2"><Crown className="h-4 w-4 text-primary" /> Creator Pro</div></SelectItem>
                <SelectItem value="business"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-amber-500" /> Creator Business</div></SelectItem>
              </SelectContent>
            </Select>
          </div>
          {plan !== "free" && (
            <div className="space-y-1.5">
              <Label>Duration (days)</Label>
              <Input type="number" min={1} max={365} value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Apply"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Revenue Tab ───────────────────────────────────────────────────────────────
function RevenueTab() {
  const { data: rev, isLoading } = useQuery<Revenue>({ queryKey: ["/admin/revenue"], queryFn: () => api("/admin/revenue") });
  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (!rev) return null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Subscription Revenue" value={fmtNGN(rev.subscriptionRevenue)} sub={`${rev.proSubscribers} Pro · ${rev.businessSubscribers} Business`} color="text-primary" />
        <StatCard icon={Wallet} label="Total Platform Earned" value={fmtNGN(rev.totalPlatformEarned)} color="text-green-600" />
        <StatCard icon={DollarSign} label="Net Profit" value={fmtNGN(Math.max(0, rev.profit))} color="text-emerald-600" trend="After payouts" />
        <StatCard icon={ArrowDownCircle} label="Approved Payouts" value={fmtNGN(rev.approvedWithdrawals)} color="text-amber-600" />
        <StatCard icon={ArrowDownCircle} label="Pending Payouts" value={fmtNGN(rev.pendingWithdrawals)} color="text-orange-600" />
        <StatCard icon={Package} label="Active Marketplace Listings" value={fmt(rev.activeMarketplaceListings)} color="text-blue-600" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue Breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Subscription Revenue", value: rev.subscriptionRevenue, total: rev.subscriptionRevenue + rev.totalPlatformEarned, color: "bg-primary" },
            { label: "Creator Earnings (ad + products)", value: rev.totalPlatformEarned, total: rev.subscriptionRevenue + rev.totalPlatformEarned, color: "bg-green-500" },
            { label: "Approved Withdrawals", value: rev.approvedWithdrawals, total: rev.subscriptionRevenue + rev.totalPlatformEarned, color: "bg-amber-500" },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{fmtNGN(item.value)}</span>
              </div>
              <Progress value={item.total > 0 ? (item.value / item.total) * 100 : 0} className="h-1.5" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Withdrawals Tab ──────────────────────────────────────────────────────────
function WithdrawalsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [methodFilter, setMethodFilter] = useState("all");
  const [noteTarget, setNoteTarget] = useState<Withdrawal | null>(null);
  const [noteText, setNoteText] = useState("");

  const { data: withdrawals = [], isLoading } = useQuery<Withdrawal[]>({
    queryKey: ["/admin/withdrawals", statusFilter, methodFilter],
    queryFn: () => api(`/admin/withdrawals?status=${statusFilter}&method=${methodFilter}&limit=200`),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: number; status: string; adminNotes?: string }) =>
      api(`/admin/withdrawals/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNotes }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/withdrawals"] }); qc.invalidateQueries({ queryKey: ["/admin/stats"] }); toast({ title: "Withdrawal updated" }); setNoteTarget(null); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const parseAccount = (raw: string) => {
    try { const j = JSON.parse(raw); return Object.entries(j).map(([k, v]) => `${k}: ${v}`).join(" · "); }
    catch { return raw; }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "pending", "processing", "approved", "completed", "rejected"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="paystack">Paystack</SelectItem>
            <SelectItem value="flutterwave">Flutterwave</SelectItem>
            <SelectItem value="mobile_money">Mobile Money</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            : withdrawals.length === 0
              ? <div className="text-center py-14 text-muted-foreground"><CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No withdrawals found.</p></div>
              : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Creator</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{w.userName}</p>
                              <p className="text-xs text-muted-foreground">{w.userEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold">{fmtNGN(w.amount)}</TableCell>
                          <TableCell className="text-sm capitalize">{w.paymentMethod?.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{parseAccount(w.accountDetails)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[w.status] ?? "")}>{w.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end flex-wrap">
                              {w.status === "pending" && (
                                <>
                                  <Button size="sm" variant="outline" className="text-xs h-7 text-green-600 border-green-500/30"
                                    onClick={() => { setNoteTarget(w); setNoteText(""); }}>
                                    <CheckCircle className="h-3 w-3 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-xs h-7 text-destructive"
                                    onClick={() => updateStatus.mutate({ id: w.id, status: "rejected" })}>
                                    <XCircle className="h-3 w-3 mr-1" /> Reject
                                  </Button>
                                </>
                              )}
                              {w.status === "approved" && (
                                <Button size="sm" variant="outline" className="text-xs h-7 text-blue-600"
                                  onClick={() => updateStatus.mutate({ id: w.id, status: "completed" })}>
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
        </CardContent>
      </Card>

      <Dialog open={!!noteTarget} onOpenChange={(o) => { if (!o) setNoteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve Withdrawal</DialogTitle>
            <DialogDescription>Approve {fmtNGN(noteTarget?.amount ?? 0)} withdrawal for {noteTarget?.userName}. Add optional notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Admin Notes (optional)</Label>
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. Processed via Paystack transfer" rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteTarget(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700"
              onClick={() => noteTarget && updateStatus.mutate({ id: noteTarget.id, status: "approved", adminNotes: noteText || undefined })}
              disabled={updateStatus.isPending}>
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Ads Tab ──────────────────────────────────────────────────────────────────
const emptyAd = { title: "", description: "", imageUrl: "", ctaUrl: "", ctaText: "Learn More", advertiserName: "", earningsPerImpression: "50", isActive: true };

function AdsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyAd);

  const { data: ads = [], isLoading } = useQuery<Ad[]>({ queryKey: ["/admin/ads"], queryFn: () => api("/admin/ads") });

  const saveAd = useMutation({
    mutationFn: (data: typeof emptyAd) => {
      const body = { ...data, earningsPerImpression: parseInt(data.earningsPerImpression) || 50 };
      return editId ? api(`/admin/ads/${editId}`, { method: "PATCH", body: JSON.stringify(body) }) : api("/admin/ads", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/ads"] }); toast({ title: editId ? "Ad updated" : "Ad created" }); setDialogOpen(false); setEditId(null); setForm(emptyAd); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleAd = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => api(`/admin/ads/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/admin/ads"] }),
  });

  const deleteAd = useMutation({
    mutationFn: (id: number) => api(`/admin/ads/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/ads"] }); toast({ title: "Ad deleted" }); },
  });

  const openEdit = (ad: Ad) => {
    setEditId(ad.id);
    setForm({ title: ad.title, description: ad.description ?? "", imageUrl: ad.imageUrl ?? "", ctaUrl: ad.ctaUrl, ctaText: ad.ctaText, advertiserName: ad.advertiserName, earningsPerImpression: String(ad.earningsPerImpression), isActive: ad.isActive });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Manage sponsored ads shown on creator profiles. Each impression credits the creator's wallet.</p>
        <Button onClick={() => { setEditId(null); setForm(emptyAd); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> New Ad Slot</Button>
      </div>

      {isLoading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        : ads.length === 0
          ? <div className="text-center py-16 text-muted-foreground"><Megaphone className="h-12 w-12 opacity-20 mx-auto mb-3" /><p>No ad slots configured.</p></div>
          : (
            <div className="grid gap-4 md:grid-cols-2">
              {ads.map((ad) => (
                <Card key={ad.id} className={cn("transition-opacity", ad.isActive ? "" : "opacity-60")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate">{ad.title}</p>
                          {ad.isActive ? <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">Active</Badge> : <Badge variant="outline" className="text-xs">Inactive</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{ad.advertiserName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{ad.earningsPerImpression} kobo (₦{(ad.earningsPerImpression / 100).toFixed(2)}) / impression · {ad.ctaText}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleAd.mutate({ id: ad.id, isActive: !ad.isActive })}>
                          {ad.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(ad)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteAd.mutate(ad.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyAd); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit Ad Slot" : "New Ad Slot"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ad headline" /></div>
              <div className="space-y-1.5"><Label>Advertiser</Label><Input value={form.advertiserName} onChange={(e) => setForm((f) => ({ ...f, advertiserName: e.target.value }))} placeholder="Company name" /></div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>CTA URL</Label><Input value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))} placeholder="https://..." /></div>
              <div className="space-y-1.5"><Label>CTA Text</Label><Input value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Image URL</Label><Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." /></div>
              <div className="space-y-1.5">
                <Label>Kobo / Impression</Label>
                <Input type="number" value={form.earningsPerImpression} onChange={(e) => setForm((f) => ({ ...f, earningsPerImpression: e.target.value }))} />
                <p className="text-[10px] text-muted-foreground">= ₦{(parseInt(form.earningsPerImpression) / 100 || 0).toFixed(2)} per view</p>
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /><Label>Active</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveAd.mutate(form)} disabled={saveAd.isPending || !form.title || !form.ctaUrl || !form.advertiserName}>
              {saveAd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? "Update" : "Create Ad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { data: analytics, isLoading } = useQuery<Analytics>({ queryKey: ["/admin/analytics"], queryFn: () => api("/admin/analytics") });
  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (!analytics) return null;
  const storageGB = analytics.totalStorageBytes / (1024 ** 3);
  const storagePct = Math.min((storageGB / 10) * 100, 100);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={fmt(analytics.totalUsers)} color="text-primary" />
        <StatCard icon={Activity} label="Active (30d)" value={fmt(analytics.activeUsers30d)} sub={`${fmt(analytics.activeUsers7d)} active last 7d`} color="text-green-600" />
        <StatCard icon={HardDrive} label="Storage Used" value={fmtBytes(analytics.totalStorageBytes)} sub={`${analytics.totalUploads} files`} color="text-blue-600" />
        <StatCard icon={Zap} label="Total AI Calls" value={fmt(analytics.totalAiCalls)} sub={`${fmt(analytics.totalAiCreditsUsed)} credits used`} color="text-purple-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><HardDrive className="h-4 w-4" /> Storage Usage</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span>{fmtBytes(analytics.totalStorageBytes)}</span><span className="text-muted-foreground">/ 10 GB limit</span></div>
            <Progress value={storagePct} className="h-2" />
            <p className="text-xs text-muted-foreground">{analytics.totalUploads} uploaded files</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Top AI Tools</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(analytics.aiByTool ?? []).slice(0, 6).map((t) => {
              const max = analytics.aiByTool[0]?.credits ?? 1;
              return (
                <div key={t.tool} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{t.tool.replace(/_/g, " ")}</span>
                    <span className="font-medium">{fmt(t.credits)} credits · {fmt(t.calls)} calls</span>
                  </div>
                  <Progress value={(t.credits / max) * 100} className="h-1" />
                </div>
              );
            })}
            {(analytics.aiByTool ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No AI usage data yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Moderation Tab ──────────────────────────────────────────────────────────
function ModerationTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: uploads = [], isLoading: loadingUploads } = useQuery<Upload[]>({
    queryKey: ["/admin/uploads"], queryFn: () => api("/admin/uploads?limit=100"),
  });
  const { data: listings = [], isLoading: loadingListings } = useQuery<MarketplaceRow[]>({
    queryKey: ["/admin/marketplace"], queryFn: () => api("/admin/marketplace"),
  });

  const deleteUpload = useMutation({
    mutationFn: (id: number) => api(`/admin/uploads/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/uploads"] }); toast({ title: "File removed" }); },
  });

  const toggleListing = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api(`/admin/marketplace/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/admin/marketplace"] }),
  });

  return (
    <Tabs defaultValue="marketplace">
      <TabsList className="mb-4">
        <TabsTrigger value="marketplace" className="gap-2"><Package className="h-3.5 w-3.5" /> Marketplace ({listings.length})</TabsTrigger>
        <TabsTrigger value="uploads" className="gap-2"><HardDrive className="h-3.5 w-3.5" /> Uploads ({uploads.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="marketplace">
        <Card>
          <CardContent className="p-0">
            {loadingListings ? <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Listing</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listings.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium text-sm">{l.title}</TableCell>
                        <TableCell><p className="text-sm">{l.sellerName}</p><p className="text-xs text-muted-foreground">{l.sellerEmail}</p></TableCell>
                        <TableCell className="text-sm capitalize text-muted-foreground">{l.category.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-sm font-medium">{fmtNGN(l.price)}</TableCell>
                        <TableCell className="text-sm">{l.totalOrders}</TableCell>
                        <TableCell>{l.isActive ? <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">Active</Badge> : <Badge variant="outline" className="text-xs">Inactive</Badge>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => toggleListing.mutate({ id: l.id, isActive: !l.isActive })}>
                              {l.isActive ? <><EyeOff className="h-3 w-3 mr-1" />Deactivate</> : <><Eye className="h-3 w-3 mr-1" />Activate</>}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="uploads">
        <Card>
          <CardContent className="p-0">
            {loadingUploads ? <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploads.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="text-sm max-w-[180px] truncate font-medium">{u.originalName}</TableCell>
                        <TableCell><p className="text-sm">{u.userName}</p><p className="text-xs text-muted-foreground">{u.userEmail}</p></TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{u.fileType}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtBytes(u.fileSize)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize">{u.folder}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => window.open(u.fileUrl, "_blank")}><Eye className="h-3 w-3 mr-1" />View</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => deleteUpload.mutate(u.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// ── Notifications Tab ──────────────────────────────────────────────────────────
function NotificationsTab() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("announcement");
  const [sending, setSending] = useState(false);

  const handleBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" }); return;
    }
    setSending(true);
    try {
      const result = await api<{ success: boolean; sent: number }>("/admin/notifications/broadcast", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), message: message.trim(), type }),
      });
      toast({ title: `Notification sent to ${result.sent} creators!` });
      setTitle("");
      setMessage("");
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Broadcast Notification
          </CardTitle>
          <CardDescription>
            Send a notification to all creators on the platform. It will appear in their notification bell.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Notification Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="announcement">📢 Announcement</SelectItem>
                <SelectItem value="feature">✨ New Feature</SelectItem>
                <SelectItem value="maintenance">🔧 Maintenance</SelectItem>
                <SelectItem value="promotion">🎁 Promotion</SelectItem>
                <SelectItem value="alert">⚠️ Alert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New feature available!" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Write your message to creators..." maxLength={500} />
            <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
          </div>
          <Button onClick={handleBroadcast} disabled={sending || !title.trim() || !message.trim()} className="w-full">
            {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-2" />Send to All Creators</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex gap-3 items-start">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This will send the notification to <strong>every user</strong> on the platform. Use it for important updates, new features, or announcements only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: PlatformSettings = {
  site_name: "Creator Hub",
  site_tagline: "Grow, Monetize & Manage Your Creator Brand in One Place.",
  site_description: "Everything you need to turn your audience into a business.",
  logo_url: "",
  support_email: "support@creatorhub.app",
  platform_fee_pct: "0",
  maintenance_mode: "false",
  adsense_client_id: "",
  adsense_slot_id: "",
  google_ads_code: "",
};

function SettingsTab() {
  const { toast } = useToast();
  const [form, setForm] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["/admin/settings"], queryFn: () => api("/admin/settings"),
  });

  useEffect(() => { if (settings) setForm((prev) => ({ ...prev, ...settings })); }, [settings]);

  const save = useMutation({
    mutationFn: (data: PlatformSettings) => api("/admin/settings", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => toast({ title: "Settings saved!" }),
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const urlRes = await api<{ uploadURL: string; objectPath: string }>("/uploads/request-url", {
        method: "POST",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      await fetch(urlRes.uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      const fileUrl = urlRes.uploadURL.split("?")[0];
      set("logo_url", fileUrl);
      toast({ title: "Logo uploaded! Click 'Save All Settings' to apply." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (isLoading) return <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Branding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Site Name</Label><Input value={form.site_name} onChange={(e) => set("site_name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Tagline</Label><Input value={form.site_tagline} onChange={(e) => set("site_tagline", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.site_description} onChange={(e) => set("site_description", e.target.value)} rows={2} /></div>

          <div className="space-y-2">
            <Label>Platform Logo</Label>
            <div className="flex gap-3 items-start">
              <div className="flex-1 space-y-2">
                <Input
                  value={form.logo_url}
                  onChange={(e) => set("logo_url", e.target.value)}
                  placeholder="https://your-cdn.com/logo.png (or upload below)"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="h-3 w-3 mr-1.5" />Upload Logo File</>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                  />
                </div>
              </div>
              {form.logo_url && (
                <div className="h-14 w-14 rounded-lg border border-border overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  <img src={form.logo_url} alt="Logo preview" className="h-full w-full object-contain p-1" onError={(e) => (e.currentTarget.style.display = "none")} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" /> Google AdSense</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>AdSense Client ID</Label>
            <Input value={form.adsense_client_id} onChange={(e) => set("adsense_client_id", e.target.value)} placeholder="ca-pub-XXXXXXXXXXXXXXXX" />
          </div>
          <div className="space-y-1.5">
            <Label>Default Ad Slot ID</Label>
            <Input value={form.adsense_slot_id} onChange={(e) => set("adsense_slot_id", e.target.value)} placeholder="XXXXXXXXXX" />
          </div>
          <p className="text-xs text-muted-foreground">These are embedded on creator public profiles when no sponsored ads are active.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Google Ads / Tag Manager Code</CardTitle>
          <CardDescription>Paste your Google Tag Manager or Google Ads global site tag snippet here. It will be injected into creator pages.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.google_ads_code}
            onChange={(e) => set("google_ads_code", e.target.value)}
            rows={5}
            placeholder={"<!-- Google tag (gtag.js) -->\n<script async src=\"https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXX\"></script>\n<script>...</script>"}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground mt-2">Accepts raw HTML/script tags. Leave blank to disable.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Platform Config</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Support Email</Label><Input type="email" value={form.support_email} onChange={(e) => set("support_email", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Platform Fee % (on marketplace sales)</Label><Input type="number" min="0" max="100" value={form.platform_fee_pct} onChange={(e) => set("platform_fee_pct", e.target.value)} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><p className="font-medium text-sm">Maintenance Mode</p><p className="text-xs text-muted-foreground">Show a maintenance notice to all users.</p></div>
            <Switch checked={form.maintenance_mode === "true"} onCheckedChange={(v) => set("maintenance_mode", v ? "true" : "false")} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="w-full">
        {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save All Settings"}
      </Button>
    </div>
  );
}

// ── Plans Tab ─────────────────────────────────────────────────────────────────
const DEFAULT_PLAN_SETTINGS = {
  plan_free_name: "Free",
  plan_pro_name: "Creator Pro",
  plan_pro_price: "4900",
  plan_pro_description: "For serious creators ready to grow",
  plan_business_name: "Creator Business",
  plan_business_price: "9900",
  plan_business_description: "For growing creator businesses",
};

function PlansTab() {
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_PLAN_SETTINGS);

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/admin/settings"], queryFn: () => api("/admin/settings"),
  });

  useEffect(() => {
    if (settings) {
      setForm((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.keys(DEFAULT_PLAN_SETTINGS).map((k) => [k, settings[k] ?? (DEFAULT_PLAN_SETTINGS as any)[k]])
        ),
      }));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: (data: Record<string, string>) => api("/admin/settings", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => toast({ title: "Plan settings saved!" }),
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">Edit plan names, pricing, and descriptions. Prices are in kobo (100 = ₦1).</p>

      <Card>
        <CardHeader><CardTitle className="text-base">Free Plan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Plan Name</Label>
            <Input value={form.plan_free_name} onChange={(e) => set("plan_free_name", e.target.value)} placeholder="Free" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crown className="h-4 w-4 text-primary" /> Pro Plan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plan Name</Label>
              <Input value={form.plan_pro_name} onChange={(e) => set("plan_pro_name", e.target.value)} placeholder="Creator Pro" />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Price (kobo)</Label>
              <Input type="number" value={form.plan_pro_price} onChange={(e) => set("plan_pro_price", e.target.value)} placeholder="4900" />
              <p className="text-xs text-muted-foreground">= ₦{(Number(form.plan_pro_price) / 100).toLocaleString()}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.plan_pro_description} onChange={(e) => set("plan_pro_description", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-amber-500" /> Business Plan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plan Name</Label>
              <Input value={form.plan_business_name} onChange={(e) => set("plan_business_name", e.target.value)} placeholder="Creator Business" />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Price (kobo)</Label>
              <Input type="number" value={form.plan_business_price} onChange={(e) => set("plan_business_price", e.target.value)} placeholder="9900" />
              <p className="text-xs text-muted-foreground">= ₦{(Number(form.plan_business_price) / 100).toLocaleString()}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.plan_business_description} onChange={(e) => set("plan_business_description", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="w-full">
        {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Plan Settings"}
      </Button>
    </div>
  );
}

// ── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/admin/stats"],
    queryFn: () => api("/admin/stats"),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Platform management and oversight.</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="border rounded-xl p-2 bg-muted/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1.5">Platform</p>
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent mb-2">
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><BarChart2 className="h-3.5 w-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Users</TabsTrigger>
            <TabsTrigger value="revenue" className="gap-1.5 text-xs"><DollarSign className="h-3.5 w-3.5" />Revenue</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" />Analytics</TabsTrigger>
          </TabsList>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1.5">Financial</p>
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent mb-2">
            <TabsTrigger value="withdrawals" className="gap-1.5 text-xs"><ArrowDownCircle className="h-3.5 w-3.5" />Withdrawals</TabsTrigger>
            <TabsTrigger value="wallets" className="gap-1.5 text-xs"><WalletCards className="h-3.5 w-3.5" />Wallets</TabsTrigger>
          </TabsList>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1.5">Content & Config</p>
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent mb-2">
            <TabsTrigger value="ads" className="gap-1.5 text-xs"><Megaphone className="h-3.5 w-3.5" />Ads</TabsTrigger>
            <TabsTrigger value="moderation" className="gap-1.5 text-xs"><AlertTriangle className="h-3.5 w-3.5" />Moderation</TabsTrigger>
            <TabsTrigger value="cms" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />CMS</TabsTrigger>
            <TabsTrigger value="menus" className="gap-1.5 text-xs"><Menu className="h-3.5 w-3.5" />Menus</TabsTrigger>
          </TabsList>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1.5">Settings & Control</p>
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent">
            <TabsTrigger value="features" className="gap-1.5 text-xs"><ToggleLeft className="h-3.5 w-3.5" />Features</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" />Notifications</TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5 text-xs"><Crown className="h-3.5 w-3.5" />Plans</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs"><Settings className="h-3.5 w-3.5" />Settings</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs"><ClipboardList className="h-3.5 w-3.5" />Audit Logs</TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" />Security</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"><OverviewTab stats={stats} /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="revenue"><RevenueTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="withdrawals"><WithdrawalsTab /></TabsContent>
        <TabsContent value="wallets"><WalletMgmtTab /></TabsContent>
        <TabsContent value="ads"><AdsTab /></TabsContent>
        <TabsContent value="moderation"><ModerationTab /></TabsContent>
        <TabsContent value="cms"><CmsTab /></TabsContent>
        <TabsContent value="menus"><MenuBuilderTab /></TabsContent>
        <TabsContent value="features"><FeatureFlagsTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="plans"><PlansTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="audit"><AuditLogsTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
      </Tabs>
    </div>
  );
}
