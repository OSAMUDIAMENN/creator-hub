import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, profilesTable, uploadsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

router.post("/uploads/request-url", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, size, contentType } = req.body as { name: string; size: number; contentType: string };
  if (!name || !size || !contentType) {
    res.status(400).json({ error: "name, size, and contentType are required" }); return;
  }

  const uploadURL = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadURL);

  res.json({ uploadURL, objectPath });
});

router.get("/uploads", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const folder = req.query.folder as string | undefined;
  const query = folder
    ? db.select().from(uploadsTable).where(and(eq(uploadsTable.userId, profile.id), eq(uploadsTable.folder, folder)))
    : db.select().from(uploadsTable).where(eq(uploadsTable.userId, profile.id));

  const uploads = await query;
  res.json(uploads.map(formatUpload));
});

router.post("/uploads", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { fileName, originalName, fileUrl, fileType, mimeType, fileSize, folder } = req.body as {
    fileName: string;
    originalName: string;
    fileUrl: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    folder?: string;
  };

  if (!fileName || !fileUrl || !fileType || !mimeType || !fileSize) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }

  const [upload] = await db
    .insert(uploadsTable)
    .values({
      userId: profile.id,
      fileName,
      originalName: originalName || fileName,
      fileUrl,
      fileType,
      mimeType,
      fileSize,
      folder: folder || "general",
    })
    .returning();

  res.status(201).json(formatUpload(upload));
});

router.delete("/uploads/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(String(req.params.id), 10);
  await db.delete(uploadsTable).where(eq(uploadsTable.id, id));
  res.status(204).send();
});

function formatUpload(u: typeof uploadsTable.$inferSelect) {
  return {
    id: u.id,
    fileName: u.fileName,
    originalName: u.originalName,
    fileUrl: u.fileUrl,
    fileType: u.fileType,
    mimeType: u.mimeType,
    fileSize: u.fileSize,
    folder: u.folder,
    createdAt: u.createdAt.toISOString(),
  };
}

export default router;
