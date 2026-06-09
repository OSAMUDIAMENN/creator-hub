import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, sql, sum, count } from "drizzle-orm";
import {
  db, profilesTable, transactionsTable, walletsTable,
  withdrawalsTable, tipsTable, marketplaceOrdersTable, productPurchasesTable,
  adImpressionsTable, adsTable,
} from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

function getMonthRange(monthsBack: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59);
  return { start, end, label: start.toLocaleString("default", { month: "short", year: "2-digit" }) };
}

router.get("/revenue/analytics", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const uid = profile.id;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const allTx = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, uid), gte(transactionsTable.createdAt, sixMonthsAgo)))
    .orderBy(desc(transactionsTable.createdAt));

  const monthlyMap: Record<string, { label: string; product_sales: number; ad_revenue: number; tips: number; marketplace: number; subscriptions: number; total: number }> = {};

  for (let i = 5; i >= 0; i--) {
    const r = getMonthRange(i);
    monthlyMap[r.label] = { label: r.label, product_sales: 0, ad_revenue: 0, tips: 0, marketplace: 0, subscriptions: 0, total: 0 };
  }

  let totalProductSales = 0;
  let totalAdRevenue = 0;
  let totalTips = 0;
  let totalMarketplace = 0;

  for (const tx of allTx) {
    if (tx.status !== "completed" || tx.type !== "earning") continue;
    const d = new Date(tx.createdAt);
    const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
    if (!monthlyMap[label]) continue;

    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(tx.metadata ?? "{}"); } catch {}

    const amt = Number(tx.amount);
    const src = String(meta.source ?? "");

    if (src === "ad_impression") {
      monthlyMap[label].ad_revenue += amt;
      totalAdRevenue += amt;
    } else if (src === "tip") {
      monthlyMap[label].tips += amt;
      totalTips += amt;
    } else if (src === "marketplace_order") {
      monthlyMap[label].marketplace += amt;
      totalMarketplace += amt;
    } else {
      monthlyMap[label].product_sales += amt;
      totalProductSales += amt;
    }
    monthlyMap[label].total += amt;
  }

  const monthlyEarnings = Object.values(monthlyMap);

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, uid));

  const [pendingWd] = await db
    .select({ total: sum(withdrawalsTable.amount), cnt: count() })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.userId, uid), eq(withdrawalsTable.status, "pending")));

  const recentTx = allTx.slice(0, 10).map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    description: tx.description,
    status: tx.status,
    createdAt: tx.createdAt.toISOString(),
  }));

  const revenueBreakdown = {
    product_sales: totalProductSales,
    ad_revenue: totalAdRevenue,
    tips: totalTips,
    marketplace: totalMarketplace,
  };

  res.json({
    monthlyEarnings,
    revenueBreakdown,
    wallet: {
      balance: Number(wallet?.balance ?? 0),
      totalEarned: Number(wallet?.totalEarned ?? 0),
      totalWithdrawn: Number(wallet?.totalWithdrawn ?? 0),
    },
    pendingWithdrawals: {
      count: pendingWd?.cnt ?? 0,
      amount: Number(pendingWd?.total ?? 0),
    },
    recentTransactions: recentTx,
  });
});

router.get("/revenue/earnings-report", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { from, to } = req.query as { from?: string; to?: string };
  const fromDate = from ? new Date(from) : new Date(Date.now() - 90 * 86400_000);
  const toDate = to ? new Date(to) : new Date();

  const txs = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, profile.id),
        gte(transactionsTable.createdAt, fromDate),
        lte(transactionsTable.createdAt, toDate),
      )
    )
    .orderBy(desc(transactionsTable.createdAt));

  const rows = ["Date,Type,Description,Amount (NGN),Status,Reference"];
  for (const tx of txs) {
    const date = tx.createdAt.toISOString().split("T")[0];
    const amount = Number(tx.amount).toFixed(2);
    const desc = `"${(tx.description ?? "").replace(/"/g, '""')}"`;
    rows.push(`${date},${tx.type},${desc},${amount},${tx.status},${tx.reference ?? ""}`);
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="earnings-report-${fromDate.toISOString().split("T")[0]}-to-${toDate.toISOString().split("T")[0]}.csv"`);
  res.send(rows.join("\n"));
});

router.get("/admin/revenue/overview", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);

  const [allEarnings] = await db
    .select({ total: sum(transactionsTable.amount), cnt: count() })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "earning"), eq(transactionsTable.status, "completed")));

  const [recentEarnings] = await db
    .select({ total: sum(transactionsTable.amount), cnt: count() })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "earning"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, thirtyDaysAgo)));

  const [pendingPayouts] = await db
    .select({ total: sum(withdrawalsTable.amount), cnt: count() })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "pending"));

  const [totalWithdrawn] = await db
    .select({ total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "approved"));

  const [tipStats] = await db
    .select({ total: sum(tipsTable.amount), cnt: count() })
    .from(tipsTable)
    .where(eq(tipsTable.status, "completed"));

  const [marketplaceStats] = await db
    .select({ total: sum(marketplaceOrdersTable.amount), cnt: count() })
    .from(marketplaceOrdersTable)
    .where(eq(marketplaceOrdersTable.status, "completed"));

  res.json({
    totalPlatformEarnings: Number(allEarnings?.total ?? 0),
    recentEarnings30d: Number(recentEarnings?.total ?? 0),
    recentTransactions30d: recentEarnings?.cnt ?? 0,
    pendingPayouts: {
      count: pendingPayouts?.cnt ?? 0,
      amount: Number(pendingPayouts?.total ?? 0),
    },
    totalWithdrawn: Number(totalWithdrawn?.total ?? 0),
    tips: {
      count: tipStats?.cnt ?? 0,
      amount: Number(tipStats?.total ?? 0),
    },
    marketplace: {
      count: marketplaceStats?.cnt ?? 0,
      amount: Number(marketplaceStats?.total ?? 0),
    },
  });
});

router.get("/admin/revenue/fraud-alerts", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const oneDayAgo = new Date(Date.now() - 86400_000);

  const recentWithdrawals = await db
    .select({ userId: withdrawalsTable.userId, cnt: count(), total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(gte(withdrawalsTable.createdAt, oneDayAgo))
    .groupBy(withdrawalsTable.userId);

  const alerts: Array<{ type: string; severity: string; description: string; userId?: number }> = [];

  for (const w of recentWithdrawals) {
    if ((w.cnt ?? 0) >= 3) {
      alerts.push({
        type: "rapid_withdrawals",
        severity: "high",
        description: `User ${w.userId} made ${w.cnt} withdrawal requests in 24h totalling ₦${Number(w.total ?? 0).toLocaleString()}`,
        userId: w.userId,
      });
    }
    if (Number(w.total ?? 0) > 500_000) {
      alerts.push({
        type: "large_withdrawal_volume",
        severity: "medium",
        description: `User ${w.userId} withdrew ₦${Number(w.total ?? 0).toLocaleString()} in 24h`,
        userId: w.userId,
      });
    }
  }

  const largeTx = await db
    .select()
    .from(transactionsTable)
    .where(and(gte(transactionsTable.createdAt, oneDayAgo), gte(transactionsTable.amount, "100000")))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(20);

  for (const tx of largeTx) {
    alerts.push({
      type: "large_transaction",
      severity: "low",
      description: `₦${Number(tx.amount).toLocaleString()} ${tx.type} transaction (ref: ${tx.reference ?? tx.id})`,
      userId: tx.userId,
    });
  }

  res.json({ alerts, generatedAt: new Date().toISOString() });
});

export default router;
