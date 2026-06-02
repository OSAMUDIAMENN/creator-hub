import { Router, type IRouter } from "express";
import { eq, and, sum, ne, lt } from "drizzle-orm";
import { db, profilesTable, aiUsageTable, subscriptionsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

export const PLAN_CREDITS: Record<string, number> = {
  free: 20,
  pro: 200,
  business: 1000,
};

export function getCurrentPeriodMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function getCreditBalance(userId: number): Promise<{
  totalCredits: number;
  usedCredits: number;
  purchasedCredits: number;
  remainingCredits: number;
  plan: string;
  periodMonth: string;
}> {
  const periodMonth = getCurrentPeriodMonth();

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  const plan = sub?.plan ?? "free";
  const planCredits = PLAN_CREDITS[plan] ?? 20;

  // Monthly usage (exclude purchase rows which have negative values and tool='purchase')
  const usageResult = await db
    .select({ total: sum(aiUsageTable.creditsUsed) })
    .from(aiUsageTable)
    .where(
      and(
        eq(aiUsageTable.userId, userId),
        eq(aiUsageTable.periodMonth, periodMonth),
        ne(aiUsageTable.tool, "purchase")
      )
    );
  const usedCredits = Math.max(0, Number(usageResult[0]?.total ?? 0));

  // Purchased credits across all time (negative creditsUsed rows with tool='purchase')
  const purchasedResult = await db
    .select({ total: sum(aiUsageTable.creditsUsed) })
    .from(aiUsageTable)
    .where(
      and(
        eq(aiUsageTable.userId, userId),
        eq(aiUsageTable.tool, "purchase"),
        lt(aiUsageTable.creditsUsed, 0)
      )
    );
  const purchasedCredits = Math.abs(Number(purchasedResult[0]?.total ?? 0));

  const totalCredits = planCredits + purchasedCredits;
  const remainingCredits = Math.max(0, totalCredits - usedCredits);

  return { totalCredits, usedCredits, purchasedCredits, remainingCredits, plan, periodMonth };
}

export async function checkAndConsumeCredits(
  userId: number,
  tool: string,
  creditsNeeded = 1
): Promise<{ ok: boolean; remaining: number }> {
  const balance = await getCreditBalance(userId);

  if (balance.remainingCredits < creditsNeeded) {
    return { ok: false, remaining: balance.remainingCredits };
  }

  const periodMonth = getCurrentPeriodMonth();
  await db.insert(aiUsageTable).values({ userId, tool, creditsUsed: creditsNeeded, periodMonth });
  return { ok: true, remaining: balance.remainingCredits - creditsNeeded };
}

router.get("/ai-credits", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const balance = await getCreditBalance(profile.id);
  res.json(balance);
});

export default router;
