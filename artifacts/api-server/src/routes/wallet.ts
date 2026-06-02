import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, profilesTable, walletsTable, transactionsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

export async function getOrCreateWallet(userId: number) {
  const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(walletsTable)
    .values({ userId, balance: "0.00", totalEarned: "0.00", totalWithdrawn: "0.00", currency: "NGN" })
    .returning();
  return created;
}

router.get("/wallet", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const wallet = await getOrCreateWallet(profile.id);
  res.json({
    id: wallet.id,
    balance: Number(wallet.balance),
    totalEarned: Number(wallet.totalEarned),
    totalWithdrawn: Number(wallet.totalWithdrawn),
    currency: wallet.currency,
  });
});

router.get("/transactions", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const txQuery = db.select().from(transactionsTable).where(eq(transactionsTable.userId, profile.id)).orderBy(desc(transactionsTable.createdAt)).limit(limit).offset(offset);

  const transactions = await txQuery;
  res.json(
    transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      currency: t.currency,
      description: t.description,
      reference: t.reference ?? null,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    }))
  );
});

export default router;
