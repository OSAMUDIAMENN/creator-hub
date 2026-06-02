import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, postsTable, profilesTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import {
  CreatePostBody,
  UpdatePostParams,
  UpdatePostBody,
  DeletePostParams,
  ListPostsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getUserProfileId(clerkId: string): Promise<number | null> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  return profile?.id ?? null;
}

function mapPost(p: typeof postsTable.$inferSelect) {
  return {
    id: p.id,
    userId: p.userId,
    title: p.title,
    caption: p.caption,
    platform: p.platform,
    scheduledDate: p.scheduledDate ? p.scheduledDate.toISOString() : null,
    status: p.status,
    mediaUrls: p.mediaUrls ? (JSON.parse(p.mediaUrls) as string[]) : [],
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    publishError: p.publishError ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/posts", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const queryParams = ListPostsQueryParams.safeParse(req.query);

  const profileId = await getUserProfileId(userId);
  if (!profileId) { res.json([]); return; }

  const conditions = [eq(postsTable.userId, profileId)];

  const posts = await db
    .select()
    .from(postsTable)
    .where(and(...conditions));

  let filtered = posts;
  if (queryParams.success && queryParams.data.platform) {
    filtered = filtered.filter((p) => p.platform === queryParams.data.platform);
  }
  if (queryParams.success && queryParams.data.status) {
    filtered = filtered.filter((p) => p.status === queryParams.data.status);
  }

  res.json(filtered.map(mapPost));
});

router.post("/posts", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const profileId = await getUserProfileId(userId);
  if (!profileId) { res.status(404).json({ error: "Profile not found" }); return; }

  const rawBody = req.body as { mediaUrls?: string[] };
  const [post] = await db
    .insert(postsTable)
    .values({
      userId: profileId,
      title: parsed.data.title,
      caption: parsed.data.caption ?? null,
      platform: parsed.data.platform,
      scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : null,
      status: parsed.data.status,
      mediaUrls: rawBody.mediaUrls?.length ? JSON.stringify(rawBody.mediaUrls) : null,
    })
    .returning();

  res.status(201).json(mapPost(post));
});

router.patch("/posts/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePostParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const patchBody = req.body as { mediaUrls?: string[] };
  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.caption !== undefined) updateData.caption = parsed.data.caption;
  if (parsed.data.platform !== undefined) updateData.platform = parsed.data.platform;
  if (parsed.data.scheduledDate !== undefined) updateData.scheduledDate = new Date(parsed.data.scheduledDate);
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (patchBody.mediaUrls !== undefined) updateData.mediaUrls = patchBody.mediaUrls.length ? JSON.stringify(patchBody.mediaUrls) : null;

  const [post] = await db
    .update(postsTable)
    .set(updateData)
    .where(eq(postsTable.id, params.data.id))
    .returning();

  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(mapPost(post));
});

router.delete("/posts/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePostParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(postsTable).where(eq(postsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
