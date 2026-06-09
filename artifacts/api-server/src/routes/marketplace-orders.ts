import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, profilesTable, marketplaceOrdersTable, marketplaceListingsTable, walletsTable, transactionsTable, auditLogsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

async function getAdminProfile(clerkId: string) {
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) return null;
  if (profile.isAdmin) return profile;
  if (ADMIN_EMAILS.includes(profile.email ?? "")) return profile;
  return null;
}

router.get("/marketplace-orders", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const orders = await db
    .select()
    .from(marketplaceOrdersTable)
    .where(eq(marketplaceOrdersTable.sellerId, profile.id))
    .orderBy(desc(marketplaceOrdersTable.createdAt))
    .limit(100);

  res.json(orders.map(formatOrder));
});

router.get("/marketplace-orders/buying", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const orders = await db
    .select()
    .from(marketplaceOrdersTable)
    .where(eq(marketplaceOrdersTable.buyerId, profile.id))
    .orderBy(desc(marketplaceOrdersTable.createdAt))
    .limit(100);

  res.json(orders.map(formatOrder));
});

router.get("/marketplace-orders/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const [order] = await db.select().from(marketplaceOrdersTable).where(eq(marketplaceOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (order.sellerId !== profile.id && order.buyerId !== profile.id) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  res.json(formatOrder(order));
});

router.patch("/marketplace-orders/:id/complete", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const [order] = await db.select().from(marketplaceOrdersTable).where(eq(marketplaceOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.sellerId !== profile.id) { res.status(403).json({ error: "Only the seller can mark as complete" }); return; }
  if (order.status !== "paid" && order.status !== "in_progress") {
    res.status(400).json({ error: `Cannot complete order in status: ${order.status}` }); return;
  }

  const { sellerNotes } = req.body as { sellerNotes?: string };

  const [updated] = await db
    .update(marketplaceOrdersTable)
    .set({ status: "completed", sellerNotes: sellerNotes ?? order.sellerNotes, completedAt: new Date() })
    .where(eq(marketplaceOrdersTable.id, id))
    .returning();

  res.json(formatOrder(updated));
});

router.patch("/marketplace-orders/:id/accept", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const [order] = await db.select().from(marketplaceOrdersTable).where(eq(marketplaceOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.sellerId !== profile.id) { res.status(403).json({ error: "Only the seller can accept" }); return; }
  if (order.status !== "paid") { res.status(400).json({ error: "Order must be in paid status to accept" }); return; }

  const [updated] = await db
    .update(marketplaceOrdersTable)
    .set({ status: "in_progress" })
    .where(eq(marketplaceOrdersTable.id, id))
    .returning();

  res.json(formatOrder(updated));
});

router.patch("/marketplace-orders/:id/dispute", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const [order] = await db.select().from(marketplaceOrdersTable).where(eq(marketplaceOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.buyerId !== profile.id) { res.status(403).json({ error: "Only the buyer can raise a dispute" }); return; }
  if (order.status === "completed" || order.status === "refunded") {
    res.status(400).json({ error: "Cannot dispute a completed or refunded order" }); return;
  }

  const [updated] = await db
    .update(marketplaceOrdersTable)
    .set({ status: "disputed", disputedAt: new Date() })
    .where(eq(marketplaceOrdersTable.id, id))
    .returning();

  res.json(formatOrder(updated));
});

router.post("/admin/marketplace-orders/:id/refund", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const admin = await getAdminProfile(clerkId);
  if (!admin) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const [order] = await db.select().from(marketplaceOrdersTable).where(eq(marketplaceOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.status === "refunded") { res.status(400).json({ error: "Already refunded" }); return; }

  const [sellerWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, order.sellerId));
  if (sellerWallet) {
    const deduct = Math.min(Number(order.amount), Number(sellerWallet.balance));
    await db.update(walletsTable).set({
      balance: sql`${walletsTable.balance} - ${deduct}`,
      totalEarned: sql`GREATEST(0, ${walletsTable.totalEarned} - ${Number(order.amount)})`,
    }).where(eq(walletsTable.id, sellerWallet.id));
  }

  const refundRef = `REFUND-MO-${id}-${Date.now()}`;
  await db.insert(transactionsTable).values({
    userId: order.sellerId,
    type: "withdrawal",
    amount: String(order.amount),
    currency: order.currency,
    description: `Refund for marketplace order #${id}`,
    reference: refundRef,
    status: "completed",
    metadata: JSON.stringify({ source: "marketplace_refund", orderId: id }),
  });

  const [updated] = await db
    .update(marketplaceOrdersTable)
    .set({ status: "refunded", refundedAt: new Date(), refundReference: refundRef })
    .where(eq(marketplaceOrdersTable.id, id))
    .returning();

  await db.insert(auditLogsTable).values({
    adminId: admin.id,
    adminEmail: admin.email ?? "",
    adminName: admin.name ?? admin.username ?? "Admin",
    action: "marketplace_order_refunded",
    entity: "marketplace_orders",
    entityId: String(id),
    changes: JSON.stringify({ orderId: id, amount: order.amount, refundRef }),
  });

  res.json(formatOrder(updated));
});

function formatOrder(o: typeof marketplaceOrdersTable.$inferSelect) {
  return {
    id: o.id,
    listingId: o.listingId,
    buyerId: o.buyerId,
    sellerId: o.sellerId,
    buyerEmail: o.buyerEmail,
    buyerName: o.buyerName,
    amount: Number(o.amount),
    currency: o.currency,
    reference: o.reference,
    status: o.status,
    message: o.message,
    requirements: o.requirements,
    sellerNotes: o.sellerNotes,
    deliveryDays: o.deliveryDays,
    completedAt: o.completedAt?.toISOString() ?? null,
    refundedAt: o.refundedAt?.toISOString() ?? null,
    disputedAt: o.disputedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

export default router;
