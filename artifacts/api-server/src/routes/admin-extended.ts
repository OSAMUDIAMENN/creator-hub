import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, desc, and, gte, count, sum, ilike, or } from "drizzle-orm";
import {
  db,
  profilesTable,
  walletsTable,
  featureFlagsTable,
  auditLogsTable,
  cmsContentTable,
  menuItemsTable,
  platformSettingsTable,
  subscriptionsTable,
  transactionsTable,
  notificationsTable,
} from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
const ADMIN_CLERK_IDS = (process.env.ADMIN_CLERK_IDS || "").split(",").filter(Boolean);

async function getAdminProfile(clerkId: string) {
  if (ADMIN_CLERK_IDS.includes(clerkId) || clerkId === process.env.SUPER_ADMIN_CLERK_ID) return null;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) return null;
  if (profile.isAdmin) return profile;
  if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(profile.email)) return profile;
  return null;
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(403).json({ error: "Forbidden" }); return; }
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  const isAdminByEnv = ADMIN_CLERK_IDS.includes(clerkId) || (profile && ADMIN_EMAILS.includes(profile.email ?? "")) || clerkId === process.env.SUPER_ADMIN_CLERK_ID;
  const isAdminByDb = profile?.isAdmin;
  if (!isAdminByEnv && !isAdminByDb) { res.status(403).json({ error: "Forbidden" }); return; }
  (req as any).adminProfile = profile;
  next();
}

async function writeAudit(req: Request, action: string, entity?: string, entityId?: string, changes?: unknown) {
  try {
    const profile = (req as any).adminProfile;
    await db.insert(auditLogsTable).values({
      adminId: profile?.id ?? null,
      adminEmail: profile?.email ?? "system",
      adminName: profile?.name ?? "Admin",
      action,
      entity: entity ?? null,
      entityId: entityId ? String(entityId) : null,
      changes: changes ? JSON.stringify(changes) : null,
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
    });
  } catch {}
}

// ── Feature Flags ─────────────────────────────────────────────────────────────
const DEFAULT_FLAGS = [
  { key: "marketplace", label: "Marketplace", description: "Creator services marketplace", status: "enabled", category: "commerce" },
  { key: "ai_chat", label: "AI Chat", description: "Conversational AI assistant", status: "enabled", category: "ai" },
  { key: "ai_video_tools", label: "AI Video Tools", description: "AI-powered video creation", status: "disabled", category: "ai" },
  { key: "ai_hook_generator", label: "AI Hook Generator", description: "Generate viral content hooks", status: "enabled", category: "ai" },
  { key: "ai_script_generator", label: "AI Script Generator", description: "Generate video/post scripts", status: "enabled", category: "ai" },
  { key: "team_accounts", label: "Team Accounts", description: "Multi-seat team workspaces", status: "premium_only", category: "collaboration" },
  { key: "team_collaboration", label: "Team Collaboration", description: "Shared drafts and workflows", status: "premium_only", category: "collaboration" },
  { key: "referral_system", label: "Referral System", description: "Invite friends for rewards", status: "enabled", category: "growth" },
  { key: "creator_wallet", label: "Creator Wallet", description: "Earnings wallet for creators", status: "enabled", category: "payments" },
  { key: "withdrawals", label: "Withdrawals", description: "Request payout of earnings", status: "enabled", category: "payments" },
  { key: "auto_posting", label: "Auto Posting", description: "Automatically publish content", status: "premium_only", category: "content" },
  { key: "scheduling", label: "Content Scheduling", description: "Schedule posts in advance", status: "enabled", category: "content" },
  { key: "analytics", label: "Analytics", description: "Detailed creator analytics", status: "enabled", category: "insights" },
  { key: "ad_revenue_sharing", label: "Ad Revenue Sharing", description: "Earn from platform ads", status: "enabled", category: "commerce" },
  { key: "brand_deals", label: "Brand Deals", description: "Connect with brand sponsors", status: "beta", category: "commerce" },
  { key: "communities", label: "Communities", description: "Creator community groups", status: "disabled", category: "social" },
  { key: "file_uploads", label: "File Uploads", description: "Upload media and documents", status: "enabled", category: "content" },
  { key: "phone_login", label: "Phone Login", description: "Sign in with phone number", status: "enabled", category: "auth" },
  { key: "social_login", label: "Social Login", description: "Sign in with Google/Twitter", status: "enabled", category: "auth" },
  { key: "marketplace_reviews", label: "Marketplace Reviews", description: "Buyer reviews on listings", status: "enabled", category: "commerce" },
  { key: "notifications", label: "Notifications", description: "In-app notification system", status: "enabled", category: "platform" },
  { key: "messaging_system", label: "Messaging System", description: "Team chat and direct messages", status: "enabled", category: "social" },
];

router.get("/admin/feature-flags", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const existing = await db.select().from(featureFlagsTable);
  const existingKeys = new Set(existing.map((f: any) => f.key));
  const toSeed = DEFAULT_FLAGS.filter((f) => !existingKeys.has(f.key));
  if (toSeed.length > 0) {
    await db.insert(featureFlagsTable).values(toSeed);
  }
  const all = await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.category, featureFlagsTable.label);
  res.json(all);
});

router.patch("/admin/feature-flags/:key", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const key = req.params.key as string;
  const { status } = req.body as { status: string };
  const valid = ["enabled", "disabled", "premium_only", "beta", "invite_only"];
  if (!valid.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  const [updated] = await db.update(featureFlagsTable).set({ status }).where(eq(featureFlagsTable.key, key)).returning();
  if (!updated) { res.status(404).json({ error: "Flag not found" }); return; }
  await writeAudit(req, "update_feature_flag", "feature_flag", key, { status });
  res.json(updated);
});

// ── Audit Logs ────────────────────────────────────────────────────────────────
router.get("/admin/audit-logs", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const search = req.query.search as string | undefined;

  let query = db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(limit).offset(offset) as any;
  if (search) {
    query = db.select().from(auditLogsTable)
      .where(or(
        ilike(auditLogsTable.action, `%${search}%`),
        ilike(auditLogsTable.entity, `%${search}%`),
        ilike(auditLogsTable.adminEmail, `%${search}%`),
      ))
      .orderBy(desc(auditLogsTable.createdAt)).limit(limit).offset(offset);
  }

  const rows = await query;
  res.json(rows.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// ── CMS Content ───────────────────────────────────────────────────────────────
router.get("/admin/cms", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const type = req.query.type as string | undefined;
  let query = db.select({
    id: cmsContentTable.id,
    type: cmsContentTable.type,
    title: cmsContentTable.title,
    slug: cmsContentTable.slug,
    excerpt: cmsContentTable.excerpt,
    status: cmsContentTable.status,
    publishedAt: cmsContentTable.publishedAt,
    createdAt: cmsContentTable.createdAt,
    updatedAt: cmsContentTable.updatedAt,
  }).from(cmsContentTable).orderBy(desc(cmsContentTable.createdAt)).limit(200) as any;
  if (type) {
    query = db.select({
      id: cmsContentTable.id,
      type: cmsContentTable.type,
      title: cmsContentTable.title,
      slug: cmsContentTable.slug,
      excerpt: cmsContentTable.excerpt,
      status: cmsContentTable.status,
      publishedAt: cmsContentTable.publishedAt,
      createdAt: cmsContentTable.createdAt,
      updatedAt: cmsContentTable.updatedAt,
    }).from(cmsContentTable).where(eq(cmsContentTable.type, type)).orderBy(desc(cmsContentTable.createdAt)).limit(200);
  }
  const rows = await query;
  res.json(rows.map((r: any) => ({
    ...r,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.get("/admin/cms/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const [row] = await db.select().from(cmsContentTable).where(eq(cmsContentTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, publishedAt: row.publishedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
});

router.post("/admin/cms", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { type, title, slug, content, excerpt, status } = req.body as Record<string, string>;
  if (!type || !title || !slug) { res.status(400).json({ error: "type, title, slug required" }); return; }
  const finalSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const profile = (req as any).adminProfile;
  const publishedAt = status === "published" ? new Date() : null;
  const [row] = await db.insert(cmsContentTable).values({
    type, title, slug: finalSlug,
    content: content ?? "",
    excerpt: excerpt ?? null,
    authorId: profile?.id ?? null,
    status: status ?? "draft",
    publishedAt,
  }).returning();
  await writeAudit(req, "create_cms_content", "cms_content", String(row.id), { type, title, slug: finalSlug });
  res.status(201).json({ ...row, publishedAt: row.publishedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
});

router.patch("/admin/cms/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { title, content, excerpt, status } = req.body as Record<string, string>;
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (excerpt !== undefined) updates.excerpt = excerpt;
  if (status !== undefined) {
    updates.status = status;
    if (status === "published") updates.publishedAt = new Date();
  }
  const [updated] = await db.update(cmsContentTable).set(updates).where(eq(cmsContentTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  await writeAudit(req, "update_cms_content", "cms_content", String(id), updates);
  res.json({ ...updated, publishedAt: updated.publishedAt?.toISOString() ?? null, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
});

router.delete("/admin/cms/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(cmsContentTable).where(eq(cmsContentTable.id, id));
  await writeAudit(req, "delete_cms_content", "cms_content", String(id));
  res.status(204).send();
});

// ── Menu Items ────────────────────────────────────────────────────────────────
router.get("/admin/menus", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const menuType = req.query.type as string | undefined;
  let rows;
  if (menuType) {
    rows = await db.select().from(menuItemsTable).where(eq(menuItemsTable.menuType, menuType)).orderBy(menuItemsTable.sortOrder);
  } else {
    rows = await db.select().from(menuItemsTable).orderBy(menuItemsTable.menuType, menuItemsTable.sortOrder);
  }
  res.json(rows.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
});

router.post("/admin/menus", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { menuType, label, url, icon, isExternal, isVisible } = req.body as Record<string, unknown>;
  if (!menuType || !label || !url) { res.status(400).json({ error: "menuType, label, url required" }); return; }
  const [maxOrder] = await db.select({ max: menuItemsTable.sortOrder }).from(menuItemsTable).where(eq(menuItemsTable.menuType, menuType as string)).orderBy(desc(menuItemsTable.sortOrder)).limit(1);
  const sortOrder = (maxOrder?.max ?? -1) + 1;
  const [row] = await db.insert(menuItemsTable).values({
    menuType: menuType as string,
    label: label as string,
    url: url as string,
    icon: (icon as string) ?? null,
    isExternal: Boolean(isExternal),
    isVisible: isVisible !== false,
    sortOrder,
  }).returning();
  await writeAudit(req, "create_menu_item", "menu_items", String(row.id), { menuType, label, url });
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
});

router.patch("/admin/menus/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { label, url, icon, isExternal, isVisible, sortOrder } = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (label !== undefined) updates.label = label;
  if (url !== undefined) updates.url = url;
  if (icon !== undefined) updates.icon = icon;
  if (isExternal !== undefined) updates.isExternal = isExternal;
  if (isVisible !== undefined) updates.isVisible = isVisible;
  if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
  const [updated] = await db.update(menuItemsTable).set(updates).where(eq(menuItemsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  await writeAudit(req, "update_menu_item", "menu_items", String(id), updates);
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
});

router.delete("/admin/menus/:id", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(menuItemsTable).where(eq(menuItemsTable.id, id));
  await writeAudit(req, "delete_menu_item", "menu_items", String(id));
  res.status(204).send();
});

// ── Wallet Management ─────────────────────────────────────────────────────────
router.get("/admin/wallets", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const search = req.query.search as string | undefined;

  let profilesQuery = db.select({ id: profilesTable.id, name: profilesTable.name, email: profilesTable.email, username: profilesTable.username }).from(profilesTable).limit(limit) as any;
  if (search) {
    profilesQuery = db.select({ id: profilesTable.id, name: profilesTable.name, email: profilesTable.email, username: profilesTable.username })
      .from(profilesTable)
      .where(or(ilike(profilesTable.name, `%${search}%`), ilike(profilesTable.email, `%${search}%`), ilike(profilesTable.username, `%${search}%`)))
      .limit(limit);
  }

  const profiles = await profilesQuery;
  const result = await Promise.all(profiles.map(async (p: any) => {
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, p.id));
    return {
      userId: p.id,
      name: p.name,
      email: p.email,
      username: p.username,
      balance: wallet ? Number(wallet.balance) : 0,
      totalEarned: wallet ? Number(wallet.totalEarned) : 0,
      totalWithdrawn: wallet ? Number(wallet.totalWithdrawn) : 0,
      isFrozen: wallet?.isFrozen ?? false,
      frozenReason: wallet?.frozenReason ?? null,
      walletId: wallet?.id ?? null,
    };
  }));
  res.json(result);
});

router.patch("/admin/wallets/:userId", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.params.userId as string, 10);
  const { isFrozen, frozenReason, adjustAmount, adjustNote } = req.body as { isFrozen?: boolean; frozenReason?: string; adjustAmount?: number; adjustNote?: string };

  let wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).then((r: any) => r[0]);
  if (!wallet) {
    const [newWallet] = await db.insert(walletsTable).values({ userId }).returning();
    wallet = newWallet;
  }

  if (isFrozen !== undefined) {
    await db.update(walletsTable).set({ isFrozen, frozenReason: frozenReason ?? null }).where(eq(walletsTable.userId, userId));
    await writeAudit(req, isFrozen ? "freeze_wallet" : "unfreeze_wallet", "wallets", String(userId), { isFrozen, frozenReason });
  }

  if (adjustAmount !== undefined && adjustAmount !== 0) {
    const currentBalance = Number(wallet.balance);
    const newBalance = Math.max(0, currentBalance + adjustAmount);
    await db.update(walletsTable).set({ balance: String(newBalance) }).where(eq(walletsTable.userId, userId));
    await db.insert(transactionsTable).values({
      userId,
      type: "adjustment",
      amount: String(adjustAmount),
      currency: "NGN",
      description: adjustNote ?? `Admin balance adjustment`,
      reference: `ADJ-${Date.now()}`,
      status: "completed",
      metadata: JSON.stringify({ adminAdjustment: true }),
    });
    await writeAudit(req, "adjust_wallet_balance", "wallets", String(userId), { adjustAmount, adjustNote, newBalance });
  }

  const [updated] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  res.json({ success: true, balance: Number(updated.balance), isFrozen: updated.isFrozen });
});

// ── Enhanced Notifications (with audience targeting) ──────────────────────────
router.post("/admin/notifications/broadcast-targeted", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { title, message, type, audience } = req.body as { title?: string; message?: string; type?: string; audience?: string };
  if (!title || !message) { res.status(400).json({ error: "title and message required" }); return; }

  const notifType = type ?? "announcement";
  let profiles: { id: number }[] = [];

  if (audience === "premium") {
    const subs = await db.select({ userId: walletsTable.userId }).from(walletsTable)
      .innerJoin(profilesTable, eq(walletsTable.userId, profilesTable.id))
      .innerJoin(subscriptionsTable, eq(subscriptionsTable.userId, profilesTable.id))
      .where(and(eq(subscriptionsTable.status, "active")));
    const ids = new Set(subs.map((s: any) => s.userId as number));
    profiles = (Array.from(ids) as number[]).map((id) => ({ id }));
  } else {
    profiles = await db.select({ id: profilesTable.id }).from(profilesTable);
  }

  let sent = 0;
  for (const p of profiles) {
    try {
      await db.insert(notificationsTable).values({
        userId: p.id, type: notifType, title, message,
        data: JSON.stringify({ broadcast: true, audience: audience ?? "all" }),
      });
      sent++;
    } catch {}
  }

  await writeAudit(req, "broadcast_notification", "notifications", undefined, { title, audience, sent });
  res.json({ success: true, sent });
});

// ── Security — Blocked IPs ────────────────────────────────────────────────────
router.get("/admin/security/blocked-ips", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "blocked_ips"));
  const ips: string[] = row ? JSON.parse(row.value) : [];
  res.json({ blockedIps: ips });
});

router.post("/admin/security/blocked-ips", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { ip } = req.body as { ip: string };
  if (!ip) { res.status(400).json({ error: "ip required" }); return; }
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "blocked_ips"));
  const ips: string[] = row ? JSON.parse(row.value) : [];
  if (!ips.includes(ip)) {
    ips.push(ip);
    if (row) {
      await db.update(platformSettingsTable).set({ value: JSON.stringify(ips) }).where(eq(platformSettingsTable.key, "blocked_ips"));
    } else {
      await db.insert(platformSettingsTable).values({ key: "blocked_ips", value: JSON.stringify(ips) });
    }
    await writeAudit(req, "block_ip", "security", ip);
  }
  res.json({ blockedIps: ips });
});

router.delete("/admin/security/blocked-ips/:ip", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const ip = decodeURIComponent(req.params.ip as string);
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "blocked_ips"));
  const ips: string[] = row ? JSON.parse(row.value) : [];
  const filtered = ips.filter((i) => i !== ip);
  if (row) {
    await db.update(platformSettingsTable).set({ value: JSON.stringify(filtered) }).where(eq(platformSettingsTable.key, "blocked_ips"));
  }
  await writeAudit(req, "unblock_ip", "security", ip);
  res.json({ blockedIps: filtered });
});

// ── Extended Stats ────────────────────────────────────────────────────────────
router.get("/admin/extended-stats", requireAuth(), requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const [totalUsers] = await db.select({ count: count() }).from(profilesTable);
  const [totalProducts] = await db.select({ count: count() }).from(cmsContentTable);
  const [totalFlags] = await db.select({ count: count() }).from(featureFlagsTable);
  const [frozenWallets] = await db.select({ count: count() }).from(walletsTable).where(eq(walletsTable.isFrozen, true));
  const [totalCms] = await db.select({ count: count() }).from(cmsContentTable);
  const [totalMenuItems] = await db.select({ count: count() }).from(menuItemsTable);
  const [totalAuditLogs] = await db.select({ count: count() }).from(auditLogsTable);

  res.json({
    totalUsers: totalUsers.count,
    frozenWallets: frozenWallets.count,
    totalCmsContent: totalCms.count,
    totalMenuItems: totalMenuItems.count,
    totalAuditLogs: totalAuditLogs.count,
  });
});

export default router;
