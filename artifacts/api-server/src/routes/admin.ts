import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, count, sum, desc, and, gte, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  subscriptionsTable,
  withdrawalsTable,
  aiUsageTable,
  transactionsTable,
  walletsTable,
  uploadsTable,
  adsTable,
  marketplaceListingsTable,
  platformSettingsTable,
  notificationsTable,
} from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

const ADMIN_CLERK_IDS = (process.env.ADMIN_CLERK_IDS || "").split(",").filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);

async function getAdminProfile(clerkId: string) {
  if (ADMIN_CLERK_IDS.includes(clerkId) || clerkId === process.env.SUPER_ADMIN_CLERK_ID) return true;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) return false;
  if (profile.isAdmin) return true;
  if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(profile.email)) {
    if (!profile.isAdmin) {
      await db.update(profilesTable).set({ isAdmin: true, role: "admin" }).where(eq(profilesTable.id, profile.id));
    }
    return true;
  }
  return false;
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(403).json({ error: "Forbidden" }); return; }
  const ok = await getAdminProfile(clerkId);
  if (!ok) { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

router.get("/admin/check", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  const isAdmin = clerkId ? await getAdminProfile(clerkId) : false;
  res.json({ isAdmin });
});

// ── Stats ────────────────────────────────────────────────────────────────────
router.get("/admin/stats", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const [usersResult] = await db.select({ count: count() }).from(profilesTable);
  const [activeSubsResult] = await db.select({ count: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active"));
  const [pendingWithdrawalsCountResult] = await db.select({ count: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));
  const [pendingWithdrawalsAmountResult] = await db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));
  const [aiCreditsResult] = await db.select({ total: sum(aiUsageTable.creditsUsed) }).from(aiUsageTable);
  const [walletTotals] = await db.select({ totalEarned: sum(walletsTable.totalEarned), totalWithdrawn: sum(walletsTable.totalWithdrawn) }).from(walletsTable);
  const [proSubs] = await db.select({ count: count() }).from(subscriptionsTable).where(and(eq(subscriptionsTable.plan, "pro"), eq(subscriptionsTable.status, "active")));
  const [bizSubs] = await db.select({ count: count() }).from(subscriptionsTable).where(and(eq(subscriptionsTable.plan, "business"), eq(subscriptionsTable.status, "active")));
  const [suspendedResult] = await db.select({ count: count() }).from(profilesTable).where(eq(profilesTable.isSuspended, true));
  const [totalTransactionsResult] = await db.select({ count: count(), total: sum(transactionsTable.amount) }).from(transactionsTable).where(eq(transactionsTable.status, "completed"));
  const [totalAdsResult] = await db.select({ count: count() }).from(adsTable).where(eq(adsTable.isActive, true));

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [newUsersResult] = await db.select({ count: count() }).from(profilesTable).where(gte(profilesTable.createdAt, startOfMonth));

  res.json({
    totalUsers: usersResult.count,
    newUsersThisMonth: newUsersResult.count,
    activeSubscriptions: activeSubsResult.count,
    proSubscriptions: proSubs.count,
    businessSubscriptions: bizSubs.count,
    pendingWithdrawals: pendingWithdrawalsCountResult.count,
    pendingWithdrawalsAmount: Number(pendingWithdrawalsAmountResult?.total ?? 0),
    totalAiCreditsUsed: Number(aiCreditsResult.total ?? 0),
    totalEarned: Number(walletTotals?.totalEarned ?? 0),
    totalWithdrawn: Number(walletTotals?.totalWithdrawn ?? 0),
    suspendedUsers: suspendedResult.count,
    totalCompletedTransactions: totalTransactionsResult.count,
    totalTransactionVolume: Number(totalTransactionsResult.total ?? 0),
    activeAds: totalAdsResult.count,
  });
});

// ── Revenue ──────────────────────────────────────────────────────────────────
router.get("/admin/revenue", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const [walletTotals] = await db.select({ totalEarned: sum(walletsTable.totalEarned), totalWithdrawn: sum(walletsTable.totalWithdrawn) }).from(walletsTable);
  const [proSubs] = await db.select({ count: count() }).from(subscriptionsTable).where(and(eq(subscriptionsTable.plan, "pro"), eq(subscriptionsTable.status, "active")));
  const [bizSubs] = await db.select({ count: count() }).from(subscriptionsTable).where(and(eq(subscriptionsTable.plan, "business"), eq(subscriptionsTable.status, "active")));
  const [approvedWithdrawals] = await db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "approved"));
  const [pendingWithdrawals] = await db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));
  const [marketplaceListings] = await db.select({ count: count() }).from(marketplaceListingsTable).where(eq(marketplaceListingsTable.isActive, true));

  const PRO_PRICE = 4900;
  const BIZ_PRICE = 9900;
  const subscriptionRevenue = (proSubs.count * PRO_PRICE) + (bizSubs.count * BIZ_PRICE);

  res.json({
    totalPlatformEarned: Number(walletTotals?.totalEarned ?? 0),
    subscriptionRevenue,
    proSubscribers: proSubs.count,
    businessSubscribers: bizSubs.count,
    totalWithdrawn: Number(walletTotals?.totalWithdrawn ?? 0),
    approvedWithdrawals: Number(approvedWithdrawals?.total ?? 0),
    pendingWithdrawals: Number(pendingWithdrawals?.total ?? 0),
    activeMarketplaceListings: marketplaceListings.count,
    profit: subscriptionRevenue - Number(approvedWithdrawals?.total ?? 0),
  });
});

// ── Revenue Chart (daily 30-day trend) ───────────────────────────────────────
router.get("/admin/revenue-chart", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const days = Math.min(Number(req.query.days) || 30, 90);

  const rows = await db.execute(sql`
    WITH date_series AS (
      SELECT generate_series(
        (CURRENT_DATE - INTERVAL '1 day' * ${days - 1})::date,
        CURRENT_DATE::date,
        '1 day'::interval
      )::date AS day
    ),
    daily_signups AS (
      SELECT DATE(created_at) AS day, COUNT(*) AS signups
      FROM profiles
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * ${days - 1}
      GROUP BY 1
    ),
    daily_revenue AS (
      SELECT DATE(created_at) AS day,
             COALESCE(SUM(amount), 0) AS revenue
      FROM transactions
      WHERE status = 'completed'
        AND created_at >= CURRENT_DATE - INTERVAL '1 day' * ${days - 1}
      GROUP BY 1
    )
    SELECT
      ds.day::text AS date,
      COALESCE(sg.signups, 0)::int AS signups,
      COALESCE(dr.revenue, 0)::numeric AS revenue
    FROM date_series ds
    LEFT JOIN daily_signups sg ON sg.day = ds.day
    LEFT JOIN daily_revenue dr ON dr.day = ds.day
    ORDER BY ds.day
  `);

  res.json(rows.rows);
});

// ── Users ────────────────────────────────────────────────────────────────────
router.get("/admin/users", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;

  const allProfiles = await db.select().from(profilesTable).orderBy(desc(profilesTable.createdAt)).limit(limit).offset(offset);

  const result = await Promise.all(
    allProfiles.map(async (p) => {
      const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, p.id));
      const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, p.id));
      const [pendingAmt] = await db
        .select({ total: sum(withdrawalsTable.amount) })
        .from(withdrawalsTable)
        .where(and(eq(withdrawalsTable.userId, p.id), eq(withdrawalsTable.status, "pending")));
      return {
        id: p.id,
        name: p.name,
        username: p.username,
        email: p.email,
        role: p.role,
        isAdmin: p.isAdmin,
        isSuspended: p.isSuspended,
        plan: sub?.plan ?? "free",
        subStatus: sub?.status ?? "active",
        balance: wallet ? Number(wallet.balance) : 0,
        totalEarned: wallet ? Number(wallet.totalEarned) : 0,
        pendingWithdrawalsAmount: Number(pendingAmt?.total ?? 0),
        createdAt: p.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.patch("/admin/users/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.params.id, 10);
  const { isSuspended, isAdmin, role, name } = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (isSuspended !== undefined) updates.isSuspended = isSuspended;
  if (isAdmin !== undefined) updates.isAdmin = isAdmin;
  if (role !== undefined) updates.role = role;
  if (name !== undefined) updates.name = name;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [updated] = await db.update(profilesTable).set(updates).where(eq(profilesTable.id, userId)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ success: true });
});

router.delete("/admin/users/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.params.id, 10);
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (!profile) { res.status(404).json({ error: "User not found" }); return; }
  await db.delete(profilesTable).where(eq(profilesTable.id, userId));
  res.json({ success: true });
});

router.post("/admin/users/:id/subscription", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  const { plan, periodDays, status } = req.body as { plan?: string; periodDays?: number; status?: string };
  const validPlans = ["free", "pro", "business"];
  if (plan && !validPlans.includes(plan)) { res.status(400).json({ error: "Invalid plan" }); return; }
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (!profile) { res.status(404).json({ error: "User not found" }); return; }
  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  const now = new Date();
  const days = typeof periodDays === "number" && periodDays > 0 ? periodDays : 30;
  const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const updates: Record<string, unknown> = {};
  if (plan) updates.plan = plan;
  if (status) updates.status = status;
  if (plan && plan !== "free") { updates.status = status ?? "active"; updates.currentPeriodStart = now; updates.currentPeriodEnd = periodEnd; updates.cancelAtPeriodEnd = false; }
  if (plan === "free") { updates.status = "active"; updates.currentPeriodStart = null; updates.currentPeriodEnd = null; updates.cancelAtPeriodEnd = false; }
  let sub;
  if (existing) {
    [sub] = await db.update(subscriptionsTable).set(updates).where(eq(subscriptionsTable.userId, userId)).returning();
  } else {
    [sub] = await db.insert(subscriptionsTable).values({ userId, plan: (plan ?? "free") as string, status: (updates.status as string) ?? "active", currentPeriodStart: updates.currentPeriodStart as Date | undefined, currentPeriodEnd: updates.currentPeriodEnd as Date | undefined, cancelAtPeriodEnd: false }).returning();
  }
  const { userId: adminClerkId } = getAuth(req);
  if (plan && plan !== "free") {
    await db.insert(transactionsTable).values({ userId, type: "subscription", amount: "0", currency: "NGN", description: `Admin override: plan set to ${plan} for ${days} days`, reference: `ADMIN-${Date.now()}`, status: "completed", metadata: JSON.stringify({ adminClerkId, plan, periodDays: days, override: true }) });
  }
  res.json({ id: sub.id, plan: sub.plan, status: sub.status });
});

// ── Withdrawals ──────────────────────────────────────────────────────────────
router.get("/admin/withdrawals", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const method = req.query.method as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  let query = db.select({
    id: withdrawalsTable.id,
    userId: withdrawalsTable.userId,
    amount: withdrawalsTable.amount,
    currency: withdrawalsTable.currency,
    status: withdrawalsTable.status,
    paymentMethod: withdrawalsTable.paymentMethod,
    accountDetails: withdrawalsTable.accountDetails,
    adminNotes: withdrawalsTable.adminNotes,
    processedAt: withdrawalsTable.processedAt,
    createdAt: withdrawalsTable.createdAt,
    userName: profilesTable.name,
    userEmail: profilesTable.email,
    userUsername: profilesTable.username,
  }).from(withdrawalsTable).innerJoin(profilesTable, eq(withdrawalsTable.userId, profilesTable.id)).orderBy(desc(withdrawalsTable.createdAt)).limit(limit) as any;

  const conditions = [];
  if (status && status !== "all") conditions.push(eq(withdrawalsTable.status, status));
  if (method && method !== "all") conditions.push(eq(withdrawalsTable.paymentMethod, method));
  if (conditions.length > 0) query = query.where(and(...conditions));

  const rows = await query;
  res.json(rows.map((r: any) => ({
    ...r,
    amount: Number(r.amount),
    processedAt: r.processedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.patch("/admin/withdrawals/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
  const updates: Record<string, unknown> = {};
  if (status) { updates.status = status; if (["approved", "completed", "rejected"].includes(status)) updates.processedAt = new Date(); }
  if (adminNotes !== undefined) updates.adminNotes = adminNotes;
  const [updated] = await db.update(withdrawalsTable).set(updates).where(eq(withdrawalsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, status: updated.status });
});

// ── Ads ──────────────────────────────────────────────────────────────────────
router.get("/admin/ads", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const ads = await db.select().from(adsTable).orderBy(desc(adsTable.createdAt));
  res.json(ads.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

router.post("/admin/ads", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { title, description, imageUrl, ctaUrl, ctaText, advertiserName, earningsPerImpression, isActive } = req.body as Record<string, unknown>;
  if (!title || !ctaUrl || !advertiserName) { res.status(400).json({ error: "title, ctaUrl, advertiserName required" }); return; }
  const [ad] = await db.insert(adsTable).values({
    title: title as string, description: description as string | undefined, imageUrl: imageUrl as string | undefined,
    ctaUrl: ctaUrl as string, ctaText: (ctaText as string) || "Learn More", advertiserName: advertiserName as string,
    earningsPerImpression: Number(earningsPerImpression) || 50, isActive: Boolean(isActive ?? true),
  }).returning();
  res.status(201).json({ ...ad, createdAt: ad.createdAt.toISOString() });
});

router.patch("/admin/ads/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { isActive, title, description, imageUrl, ctaUrl, ctaText, advertiserName, earningsPerImpression } = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (isActive !== undefined) updates.isActive = isActive;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (ctaUrl !== undefined) updates.ctaUrl = ctaUrl;
  if (ctaText !== undefined) updates.ctaText = ctaText;
  if (advertiserName !== undefined) updates.advertiserName = advertiserName;
  if (earningsPerImpression !== undefined) updates.earningsPerImpression = Number(earningsPerImpression);
  const [updated] = await db.update(adsTable).set(updates).where(eq(adsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/admin/ads/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(adsTable).where(eq(adsTable.id, id));
  res.status(204).send();
});

// ── Analytics ────────────────────────────────────────────────────────────────
router.get("/admin/analytics", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total] = await db.select({ count: count() }).from(profilesTable);
  const [active30] = await db.select({ count: count() }).from(profilesTable).where(gte(profilesTable.updatedAt, thirtyDaysAgo));
  const [active7] = await db.select({ count: count() }).from(profilesTable).where(gte(profilesTable.updatedAt, sevenDaysAgo));
  const [totalUploads] = await db.select({ count: count(), totalSize: sum(uploadsTable.fileSize) }).from(uploadsTable);
  const [totalAiUsage] = await db.select({ count: count(), totalCredits: sum(aiUsageTable.creditsUsed) }).from(aiUsageTable);
  const [totalListings] = await db.select({ count: count() }).from(marketplaceListingsTable);

  const aiByTool = await db
    .select({ tool: aiUsageTable.tool, total: sum(aiUsageTable.creditsUsed), count: count() })
    .from(aiUsageTable)
    .groupBy(aiUsageTable.tool)
    .orderBy(desc(sum(aiUsageTable.creditsUsed)))
    .limit(10);

  res.json({
    totalUsers: total.count,
    activeUsers30d: active30.count,
    activeUsers7d: active7.count,
    totalUploads: totalUploads.count,
    totalStorageBytes: Number(totalUploads.totalSize ?? 0),
    totalAiCalls: totalAiUsage.count,
    totalAiCreditsUsed: Number(totalAiUsage.totalCredits ?? 0),
    totalMarketplaceListings: totalListings.count,
    aiByTool: aiByTool.map((r) => ({ tool: r.tool, credits: Number(r.total ?? 0), calls: r.count })),
  });
});

// ── Moderation — Uploads ──────────────────────────────────────────────────────
router.get("/admin/uploads", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = await db.select({
    id: uploadsTable.id,
    userId: uploadsTable.userId,
    fileName: uploadsTable.fileName,
    originalName: uploadsTable.originalName,
    fileUrl: uploadsTable.fileUrl,
    fileType: uploadsTable.fileType,
    fileSize: uploadsTable.fileSize,
    folder: uploadsTable.folder,
    createdAt: uploadsTable.createdAt,
    userName: profilesTable.name,
    userEmail: profilesTable.email,
  }).from(uploadsTable).innerJoin(profilesTable, eq(uploadsTable.userId, profilesTable.id)).orderBy(desc(uploadsTable.createdAt)).limit(limit);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.delete("/admin/uploads/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(uploadsTable).where(eq(uploadsTable.id, id));
  res.status(204).send();
});

// ── Moderation — Marketplace ──────────────────────────────────────────────────
router.get("/admin/marketplace", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const rows = await db.select({
    id: marketplaceListingsTable.id,
    sellerId: marketplaceListingsTable.sellerId,
    title: marketplaceListingsTable.title,
    category: marketplaceListingsTable.category,
    serviceType: marketplaceListingsTable.serviceType,
    price: marketplaceListingsTable.price,
    isActive: marketplaceListingsTable.isActive,
    totalOrders: marketplaceListingsTable.totalOrders,
    createdAt: marketplaceListingsTable.createdAt,
    sellerName: profilesTable.name,
    sellerEmail: profilesTable.email,
  }).from(marketplaceListingsTable).innerJoin(profilesTable, eq(marketplaceListingsTable.sellerId, profilesTable.id)).orderBy(desc(marketplaceListingsTable.createdAt)).limit(200);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.patch("/admin/marketplace/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { isActive } = req.body as { isActive: boolean };
  await db.update(marketplaceListingsTable).set({ isActive }).where(eq(marketplaceListingsTable.id, id));
  res.json({ success: true });
});

// ── Platform Settings ─────────────────────────────────────────────────────────
router.get("/admin/settings", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const settings = await db.select().from(platformSettingsTable);
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  res.json(map);
});

router.patch("/admin/settings", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value !== "string") continue;
    const existing = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key));
    if (existing.length > 0) {
      await db.update(platformSettingsTable).set({ value }).where(eq(platformSettingsTable.key, key));
    } else {
      await db.insert(platformSettingsTable).values({ key, value });
    }
  }
  res.json({ success: true });
});

// ── Broadcast Notifications ───────────────────────────────────────────────────
router.post("/admin/notifications/broadcast", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { title, message, type } = req.body as { title?: string; message?: string; type?: string };
  if (!title || !message) { res.status(400).json({ error: "title and message are required" }); return; }

  const notifType = type ?? "announcement";
  const allProfiles = await db.select({ id: profilesTable.id }).from(profilesTable);

  let sent = 0;
  for (const p of allProfiles) {
    try {
      await db.insert(notificationsTable).values({
        userId: p.id,
        type: notifType,
        title,
        message,
        data: JSON.stringify({ broadcast: true }),
      });
      sent++;
    } catch {}
  }

  res.json({ success: true, sent });
});

export default router;
