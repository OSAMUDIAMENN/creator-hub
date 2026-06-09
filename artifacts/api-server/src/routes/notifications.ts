import { Router, type IRouter } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db, profilesTable, notificationsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

async function getProfileId(clerkId: string): Promise<number | null> {
  const [p] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  return p?.id ?? null;
}

router.get("/notifications", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profileId = await getProfileId(userId);
  if (!profileId) { res.json([]); return; }

  const items = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, profileId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(items.map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    data: n.data ? JSON.parse(n.data) : null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  })));
});

router.get("/notifications/unread-count", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.json({ count: 0 }); return; }
  const profileId = await getProfileId(userId);
  if (!profileId) { res.json({ count: 0 }); return; }

  const items = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, profileId), isNull(notificationsTable.readAt)));

  res.json({ count: items.length });
});

router.patch("/notifications/:id/read", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id as string, 10);

  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(eq(notificationsTable.id, id));

  res.json({ ok: true });
});

router.post("/notifications/mark-all-read", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profileId = await getProfileId(userId);
  if (!profileId) { res.json({ ok: true }); return; }

  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, profileId), isNull(notificationsTable.readAt)));

  res.json({ ok: true });
});

export default router;
