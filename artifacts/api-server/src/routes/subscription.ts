import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, profilesTable, subscriptionsTable, platformSettingsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

export const PLAN_LIMITS = {
  free: { aiCredits: 20, maxLinks: 5, maxProducts: 3 },
  pro: { aiCredits: 200, maxLinks: 50, maxProducts: 50 },
  business: { aiCredits: 1000, maxLinks: 500, maxProducts: 500 },
};

export const PLAN_DETAILS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    currency: "NGN",
    billingPeriod: "monthly",
    aiCredits: 20,
    maxLinks: 5,
    maxProducts: 3,
    features: [
      "5 links in bio",
      "3 digital products",
      "20 AI credits/month",
      "Basic analytics",
      "Public profile page",
    ],
  },
  {
    id: "pro",
    name: "Creator Pro",
    price: 5000,
    currency: "NGN",
    billingPeriod: "monthly",
    aiCredits: 200,
    maxLinks: 50,
    maxProducts: 50,
    features: [
      "50 links in bio",
      "50 digital products",
      "200 AI credits/month",
      "Advanced analytics",
      "AI hook & script generator",
      "Thumbnail analyzer",
      "Priority support",
    ],
  },
  {
    id: "business",
    name: "Creator Business",
    price: 15000,
    currency: "NGN",
    billingPeriod: "monthly",
    aiCredits: 1000,
    maxLinks: 500,
    maxProducts: 500,
    features: [
      "Unlimited links",
      "Unlimited products",
      "1,000 AI credits/month",
      "Team collaboration",
      "Custom branding",
      "All AI tools",
      "Withdrawal support",
      "Dedicated support",
    ],
  },
];

async function getOrCreateSubscription(userId: number) {
  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(subscriptionsTable)
    .values({ userId, plan: "free", status: "active" })
    .returning();
  return created;
}

router.get("/subscription", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const sub = await getOrCreateSubscription(profile.id);
  res.json({
    id: sub.id,
    plan: sub.plan,
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    createdAt: sub.createdAt.toISOString(),
  });
});

router.get("/subscription/plans", async (_req, res): Promise<void> => {
  const settings = await db.select().from(platformSettingsTable);
  const map: Record<string, string> = {};
  for (const row of settings) map[row.key] = row.value ?? "";

  const plans = PLAN_DETAILS.map((plan) => {
    if (plan.id === "free") {
      return { ...plan, name: map["plan_free_name"] || plan.name };
    }
    if (plan.id === "pro") {
      const priceKobo = map["plan_pro_price"] ? Number(map["plan_pro_price"]) : null;
      return {
        ...plan,
        name: map["plan_pro_name"] || plan.name,
        price: priceKobo !== null ? Math.round(priceKobo / 100) : plan.price,
        description: map["plan_pro_description"] || undefined,
      };
    }
    if (plan.id === "business") {
      const priceKobo = map["plan_business_price"] ? Number(map["plan_business_price"]) : null;
      return {
        ...plan,
        name: map["plan_business_name"] || plan.name,
        price: priceKobo !== null ? Math.round(priceKobo / 100) : plan.price,
        description: map["plan_business_description"] || undefined,
      };
    }
    return plan;
  });

  res.json(plans);
});

router.post("/subscription/upgrade", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { plan } = req.body as { plan: string };
  if (!["free", "pro", "business"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan" }); return;
  }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const sub = await getOrCreateSubscription(profile.id);
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [updated] = await db
    .update(subscriptionsTable)
    .set({
      plan,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    })
    .where(eq(subscriptionsTable.id, sub.id))
    .returning();

  res.json({
    id: updated.id,
    plan: updated.plan,
    status: updated.status,
    currentPeriodStart: updated.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
