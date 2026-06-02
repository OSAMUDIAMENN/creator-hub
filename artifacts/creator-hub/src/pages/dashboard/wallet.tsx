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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const canWithdraw = wallet && (wallet.balance ?? 0) >= 1000;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet & Earnings</h1>
          <p className="text-muted-foreground mt-1">Track your earnings and request withdrawals.</p>
        </div>
        <Button onClick={() => setWithdrawOpen(true)} disabled={!canWithdraw}>
          <ArrowDownCircle className="h-4 w-4 mr-2" />
          Withdraw
        </Button>
      </div>

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
            <Skeleton className="h-9 w-32" />
          ) : (
            <div>
              <p className="text-3xl font-bold text-yellow-600">
                ₦{Number((adEarnings?.totalEarningsKobo ?? 0) / 100).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Earned from sponsored ads shown on your public profile
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Transactions + Withdrawals */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions" className="gap-2">
            <History className="h-4 w-4" /> Transaction History
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-2">
            <ArrowDownCircle className="h-4 w-4" /> Withdrawals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Transactions</CardTitle>
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
