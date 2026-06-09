import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, profilesTable, walletsTable, withdrawalsTable, transactionsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

const ADMIN_CLERK_IDS = (process.env.ADMIN_CLERK_IDS || "").split(",").filter(Boolean);

function isAdmin(clerkId: string) {
  return ADMIN_CLERK_IDS.includes(clerkId);
}

router.get("/withdrawals", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, profile.id))
    .orderBy(desc(withdrawalsTable.createdAt));

  res.json(withdrawals.map(formatWithdrawal));
});

router.post("/withdrawals", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { amount, paymentMethod, accountDetails } = req.body as {
    amount: number;
    paymentMethod: string;
    accountDetails: string;
  };

  if (!amount || amount < 1000) { res.status(400).json({ error: "Minimum withdrawal amount is ₦1,000" }); return; }
  if (!paymentMethod || !accountDetails) { res.status(400).json({ error: "Payment method and account details required" }); return; }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, profile.id));
  const balance = wallet ? Number(wallet.balance) : 0;

  if (balance < amount) {
    res.status(400).json({ error: "Insufficient wallet balance" }); return;
  }

  const [withdrawal] = await db
    .insert(withdrawalsTable)
    .values({ userId: profile.id, amount: String(amount), paymentMethod, accountDetails, status: "pending" })
    .returning();

  // Deduct from wallet balance
  if (wallet) {
    await db
      .update(walletsTable)
      .set({
        balance: String(balance - amount),
        totalWithdrawn: String(Number(wallet.totalWithdrawn) + amount),
      })
      .where(eq(walletsTable.id, wallet.id));
  }

  // Record transaction
  await db.insert(transactionsTable).values({
    userId: profile.id,
    type: "withdrawal",
    amount: String(amount),
    currency: "NGN",
    description: `Withdrawal request via ${paymentMethod}`,
    reference: `WD-${withdrawal.id}`,
    status: "pending",
  });

  res.status(201).json(formatWithdrawal(withdrawal));
});

// Admin: list all withdrawals
router.get("/admin/withdrawals", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId || !isAdmin(clerkId)) { res.status(403).json({ error: "Forbidden" }); return; }

  const status = req.query.status as string | undefined;
  const query = db.select().from(withdrawalsTable).orderBy(desc(withdrawalsTable.createdAt));
  const withdrawals = await query;
  const filtered = status ? withdrawals.filter((w: any) => w.status === status) : withdrawals;
  res.json(filtered.map(formatWithdrawal));
});

// Admin: approve withdrawal
router.post("/admin/withdrawals/:id/approve", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId || !isAdmin(clerkId)) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(String(req.params.id), 10);
  const { notes } = req.body as { notes?: string };

  const [updated] = await db
    .update(withdrawalsTable)
    .set({ status: "approved", adminNotes: notes ?? null, processedAt: new Date() })
    .where(eq(withdrawalsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Withdrawal not found" }); return; }

  // Update transaction status
  await db
    .update(transactionsTable)
    .set({ status: "completed" })
    .where(eq(transactionsTable.reference, `WD-${id}`));

  res.json(formatWithdrawal(updated));
});

// Admin: reject withdrawal
router.post("/admin/withdrawals/:id/reject", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId || !isAdmin(clerkId)) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(String(req.params.id), 10);
  const { notes } = req.body as { notes?: string };

  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!withdrawal) { res.status(404).json({ error: "Withdrawal not found" }); return; }

  // Refund balance
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, withdrawal.userId));
  if (wallet) {
    await db
      .update(walletsTable)
      .set({
        balance: String(Number(wallet.balance) + Number(withdrawal.amount)),
        totalWithdrawn: String(Math.max(0, Number(wallet.totalWithdrawn) - Number(withdrawal.amount))),
      })
      .where(eq(walletsTable.id, wallet.id));
  }

  const [updated] = await db
    .update(withdrawalsTable)
    .set({ status: "rejected", adminNotes: notes ?? null, processedAt: new Date() })
    .where(eq(withdrawalsTable.id, id))
    .returning();

  res.json(formatWithdrawal(updated));
});

function formatWithdrawal(w: typeof withdrawalsTable.$inferSelect) {
  return {
    id: w.id,
    amount: Number(w.amount),
    currency: w.currency,
    status: w.status,
    paymentMethod: w.paymentMethod,
    accountDetails: w.accountDetails,
    adminNotes: w.adminNotes ?? null,
    processedAt: w.processedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
  };
}

export default router;
