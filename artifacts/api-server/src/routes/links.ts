import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, linksTable, profilesTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import {
  CreateLinkBody,
  UpdateLinkParams,
  UpdateLinkBody,
  DeleteLinkParams,
  ReorderLinksBody,
  TrackLinkClickParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getUserProfileId(clerkId: string): Promise<number | null> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  return profile?.id ?? null;
}

function mapLink(l: typeof linksTable.$inferSelect) {
  return {
    id: l.id,
    userId: l.userId,
    title: l.title,
    url: l.url,
    icon: l.icon,
    clicks: l.clicks,
    sortOrder: l.sortOrder,
    isActive: l.isActive,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/links", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profileId = await getUserProfileId(userId);
  if (!profileId) { res.json([]); return; }

  const links = await db
    .select()
    .from(linksTable)
    .where(eq(linksTable.userId, profileId))
    .orderBy(asc(linksTable.sortOrder));

  res.json(links.map(mapLink));
});

router.post("/links", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const profileId = await getUserProfileId(userId);
  if (!profileId) { res.status(404).json({ error: "Profile not found" }); return; }

  const existing = await db
    .select()
    .from(linksTable)
    .where(eq(linksTable.userId, profileId));

  const [link] = await db
    .insert(linksTable)
    .values({
      userId: profileId,
      title: parsed.data.title,
      url: parsed.data.url,
      icon: parsed.data.icon ?? null,
      sortOrder: existing.length,
    })
    .returning();

  res.status(201).json(mapLink(link));
});

router.patch("/links/reorder", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = ReorderLinksBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const profileId = await getUserProfileId(userId);
  if (!profileId) { res.status(404).json({ error: "Profile not found" }); return; }

  for (let i = 0; i < parsed.data.ids.length; i++) {
    await db
      .update(linksTable)
      .set({ sortOrder: i })
      .where(eq(linksTable.id, parsed.data.ids[i]));
  }

  const links = await db
    .select()
    .from(linksTable)
    .where(eq(linksTable.userId, profileId))
    .orderBy(asc(linksTable.sortOrder));

  res.json(links.map(mapLink));
});

router.patch("/links/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateLinkParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateLinkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const profileId = await getUserProfileId(userId);
  if (!profileId) { res.status(404).json({ error: "Profile not found" }); return; }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.url !== undefined) updateData.url = parsed.data.url;
  if (parsed.data.icon !== undefined) updateData.icon = parsed.data.icon;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
  if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;

  const [link] = await db
    .update(linksTable)
    .set(updateData)
    .where(eq(linksTable.id, params.data.id))
    .returning();

  if (!link) { res.status(404).json({ error: "Link not found" }); return; }

  res.json(mapLink(link));
});

router.delete("/links/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteLinkParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(linksTable).where(eq(linksTable.id, params.data.id));
  res.status(204).send();
});

router.post("/links/:id/click", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = TrackLinkClickParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(linksTable).where(eq(linksTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Link not found" }); return; }

  await db
    .update(linksTable)
    .set({ clicks: existing.clicks + 1 })
    .where(eq(linksTable.id, params.data.id));

  res.json({ success: true });
});

export default router;
