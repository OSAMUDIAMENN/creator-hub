import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, profilesTable, socialAccountsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

function mapAccount(a: typeof socialAccountsTable.$inferSelect) {
  return {
    id: a.id,
    platform: a.platform,
    platformUsername: a.platformUsername ?? null,
    platformUserId: a.platformUserId ?? null,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/social-accounts", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const accounts = await db
    .select()
    .from(socialAccountsTable)
    .where(eq(socialAccountsTable.userId, profile.id));

  res.json(accounts.map(mapAccount));
});

router.post("/social-accounts/connect", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { platform, platformUsername, accessToken, refreshToken } = req.body as {
    platform: string;
    platformUsername?: string;
    accessToken?: string;
    refreshToken?: string;
  };

  if (!platform) { res.status(400).json({ error: "platform is required" }); return; }

  const [existing] = await db
    .select()
    .from(socialAccountsTable)
    .where(and(eq(socialAccountsTable.userId, profile.id), eq(socialAccountsTable.platform, platform)));

  if (existing) {
    const [updated] = await db
      .update(socialAccountsTable)
      .set({
        platformUsername: platformUsername ?? existing.platformUsername,
        accessToken: accessToken ?? existing.accessToken,
        refreshToken: refreshToken ?? existing.refreshToken,
        isActive: "true",
      })
      .where(eq(socialAccountsTable.id, existing.id))
      .returning();
    res.json(mapAccount(updated));
    return;
  }

  const [created] = await db
    .insert(socialAccountsTable)
    .values({
      userId: profile.id,
      platform,
      platformUsername: platformUsername ?? null,
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
      isActive: "true",
    })
    .returning();

  res.status(201).json(mapAccount(created));
});

router.delete("/social-accounts/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(String(req.params.id), 10);
  await db.delete(socialAccountsTable).where(eq(socialAccountsTable.id, id));
  res.status(204).send();
});

export default router;
