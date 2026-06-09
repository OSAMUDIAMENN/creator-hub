import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, profilesTable, tipsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

router.get("/tips/received", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const tips = await db
    .select()
    .from(tipsTable)
    .where(eq(tipsTable.creatorId, profile.id))
    .orderBy(desc(tipsTable.createdAt))
    .limit(200);

  res.json(tips.map((t) => ({
    id: t.id,
    tipperName: t.isAnonymous ? "Anonymous" : (t.tipperName ?? "Anonymous"),
    tipperEmail: t.isAnonymous ? null : t.tipperEmail,
    isAnonymous: t.isAnonymous,
    message: t.message,
    amount: Number(t.amount),
    currency: t.currency,
    reference: t.reference,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  })));
});

router.get("/tips/stats", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.json({ totalTips: 0, totalAmount: 0, uniqueTippers: 0 }); return; }

  const tips = await db
    .select()
    .from(tipsTable)
    .where(eq(tipsTable.creatorId, profile.id));

  const completed = tips.filter((t) => t.status === "completed");
  const totalAmount = completed.reduce((sum, t) => sum + Number(t.amount), 0);
  const uniqueEmails = new Set(completed.filter((t) => !t.isAnonymous && t.tipperEmail).map((t) => t.tipperEmail!));

  res.json({
    totalTips: completed.length,
    totalAmount,
    uniqueTippers: uniqueEmails.size,
  });
});

export default router;
