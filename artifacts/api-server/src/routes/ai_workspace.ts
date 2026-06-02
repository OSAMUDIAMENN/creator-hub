import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { aiSavedGenerationsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

router.get("/ai-workspace/saved", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const type = req.query.type as string | undefined;
  const query = db
    .select()
    .from(aiSavedGenerationsTable)
    .where(
      type
        ? and(eq(aiSavedGenerationsTable.userId, profile.id), eq(aiSavedGenerationsTable.type, type))
        : eq(aiSavedGenerationsTable.userId, profile.id)
    )
    .orderBy(desc(aiSavedGenerationsTable.createdAt))
    .limit(100);

  const rows = await query;
  res.json(rows.map((r) => ({ id: r.id, type: r.type, title: r.title, content: r.content, createdAt: r.createdAt.toISOString() })));
});

router.post("/ai-workspace/saved", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { type, title, content } = req.body as { type?: string; title?: string; content?: unknown };
  if (!type || !title || !content) { res.status(400).json({ error: "type, title, content required" }); return; }

  const [row] = await db
    .insert(aiSavedGenerationsTable)
    .values({ userId: profile.id, type, title, content: content as any })
    .returning();

  res.status(201).json({ id: row.id, type: row.type, title: row.title, content: row.content, createdAt: row.createdAt.toISOString() });
});

router.delete("/ai-workspace/saved/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const id = parseInt(req.params.id ?? "0");
  await db
    .delete(aiSavedGenerationsTable)
    .where(and(eq(aiSavedGenerationsTable.id, id), eq(aiSavedGenerationsTable.userId, profile.id)));

  res.status(204).send();
});

export default router;
