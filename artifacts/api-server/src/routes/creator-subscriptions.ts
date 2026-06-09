import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, profilesTable, creatorSubscriptionTiersTable, creatorFanSubscriptionsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

router.get("/creator-subs/tiers", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const tiers = await db
    .select()
    .from(creatorSubscriptionTiersTable)
    .where(eq(creatorSubscriptionTiersTable.creatorId, profile.id))
    .orderBy(creatorSubscriptionTiersTable.sortOrder);

  res.json(tiers.map(formatTier));
});

router.get("/public/creator-subs/:username", async (req, res): Promise<void> => {
  const { username } = req.params as { username: string };

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.username, username));
  if (!profile) { res.status(404).json({ error: "Creator not found" }); return; }

  const tiers = await db
    .select()
    .from(creatorSubscriptionTiersTable)
    .where(and(eq(creatorSubscriptionTiersTable.creatorId, profile.id), eq(creatorSubscriptionTiersTable.isActive, true)))
    .orderBy(creatorSubscriptionTiersTable.sortOrder);

  res.json({
    creatorName: profile.name ?? profile.username,
    tiers: tiers.map(formatTier),
  });
});

router.post("/creator-subs/tiers", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { name, description, price, currency, interval, perks, maxSubscribers } = req.body as {
    name: string; description?: string; price: number; currency?: string;
    interval?: string; perks?: string[]; maxSubscribers?: number;
  };

  if (!name || !price || price < 100) {
    res.status(400).json({ error: "Name and price (min ₦100) are required" }); return;
  }

  const existing = await db.select({ id: creatorSubscriptionTiersTable.id }).from(creatorSubscriptionTiersTable).where(eq(creatorSubscriptionTiersTable.creatorId, profile.id));
  if (existing.length >= 5) {
    res.status(400).json({ error: "Maximum 5 subscription tiers allowed" }); return;
  }

  const [tier] = await db
    .insert(creatorSubscriptionTiersTable)
    .values({
      creatorId: profile.id,
      name,
      description: description ?? null,
      price: String(price),
      currency: currency ?? "NGN",
      interval: interval ?? "monthly",
      perks: perks ? JSON.stringify(perks) : null,
      maxSubscribers: maxSubscribers ?? null,
      sortOrder: existing.length,
    })
    .returning();

  res.status(201).json(formatTier(tier));
});

router.patch("/creator-subs/tiers/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const tierId = parseInt(req.params.id as string, 10);
  const updates: Record<string, unknown> = {};
  const body = req.body as Record<string, unknown>;

  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.price !== undefined) updates.price = String(body.price);
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.perks !== undefined) updates.perks = Array.isArray(body.perks) ? JSON.stringify(body.perks) : body.perks;
  if (body.maxSubscribers !== undefined) updates.maxSubscribers = body.maxSubscribers;

  const [tier] = await db
    .update(creatorSubscriptionTiersTable)
    .set(updates)
    .where(and(eq(creatorSubscriptionTiersTable.id, tierId), eq(creatorSubscriptionTiersTable.creatorId, profile.id)))
    .returning();

  if (!tier) { res.status(404).json({ error: "Tier not found" }); return; }
  res.json(formatTier(tier));
});

router.delete("/creator-subs/tiers/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const tierId = parseInt(req.params.id as string, 10);
  const [activeCount] = await db
    .select({ cnt: creatorFanSubscriptionsTable.id })
    .from(creatorFanSubscriptionsTable)
    .where(and(eq(creatorFanSubscriptionsTable.tierId, tierId), eq(creatorFanSubscriptionsTable.status, "active")))
    .limit(1);

  if (activeCount) {
    res.status(400).json({ error: "Cannot delete tier with active subscribers. Deactivate it instead." }); return;
  }

  await db
    .delete(creatorSubscriptionTiersTable)
    .where(and(eq(creatorSubscriptionTiersTable.id, tierId), eq(creatorSubscriptionTiersTable.creatorId, profile.id)));

  res.status(204).send();
});

router.get("/creator-subs/subscribers", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const subs = await db
    .select()
    .from(creatorFanSubscriptionsTable)
    .where(eq(creatorFanSubscriptionsTable.creatorId, profile.id))
    .orderBy(desc(creatorFanSubscriptionsTable.createdAt));

  res.json(subs.map((s) => ({
    id: s.id,
    tierId: s.tierId,
    fanEmail: s.fanEmail,
    fanName: s.fanName,
    status: s.status,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  })));
});

function formatTier(t: typeof creatorSubscriptionTiersTable.$inferSelect) {
  let perks: string[] = [];
  try { perks = t.perks ? JSON.parse(t.perks) : []; } catch {}
  return {
    id: t.id,
    creatorId: t.creatorId,
    name: t.name,
    description: t.description,
    price: Number(t.price),
    currency: t.currency,
    interval: t.interval,
    perks,
    isActive: t.isActive,
    maxSubscribers: t.maxSubscribers,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt.toISOString(),
  };
}

export default router;
