import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, profilesTable, linksTable, productsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import {
  UpdateProfileBody,
  GetPublicProfileParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrCreateProfile(clerkId: string) {
  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  return existing;
}

router.get("/profile", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const profile = await getOrCreateProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json({
    id: profile.id,
    clerkId: profile.clerkId,
    name: profile.name,
    username: profile.username,
    email: profile.email,
    bio: profile.bio,
    profileImage: profile.profileImage,
    whatsappNumber: profile.whatsappNumber,
    theme: profile.theme,
    createdAt: profile.createdAt.toISOString(),
  });
});

router.patch("/profile", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const profile = await getOrCreateProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.username !== undefined) updateData.username = parsed.data.username;
  if (parsed.data.bio !== undefined) updateData.bio = parsed.data.bio;
  if (parsed.data.profileImage !== undefined) updateData.profileImage = parsed.data.profileImage;
  if (parsed.data.whatsappNumber !== undefined) updateData.whatsappNumber = parsed.data.whatsappNumber;
  if (parsed.data.theme !== undefined) updateData.theme = parsed.data.theme;

  const [updated] = await db
    .update(profilesTable)
    .set(updateData)
    .where(eq(profilesTable.clerkId, userId))
    .returning();

  res.json({
    id: updated.id,
    clerkId: updated.clerkId,
    name: updated.name,
    username: updated.username,
    email: updated.email,
    bio: updated.bio,
    profileImage: updated.profileImage,
    whatsappNumber: updated.whatsappNumber,
    theme: updated.theme,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.get("/profile/public/:username", async (req, res): Promise<void> => {
  const params = GetPublicProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.username, params.data.username));

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const links = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.userId, profile.id), eq(linksTable.isActive, true)))
    .orderBy(asc(linksTable.sortOrder));

  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.userId, profile.id), eq(productsTable.isActive, true)));

  res.json({
    id: profile.id,
    name: profile.name,
    username: profile.username,
    bio: profile.bio,
    profileImage: profile.profileImage,
    whatsappNumber: profile.whatsappNumber,
    theme: profile.theme,
    role: profile.role,
    links: links.map((l: any) => ({
      id: l.id,
      userId: l.userId,
      title: l.title,
      url: l.url,
      icon: l.icon,
      clicks: l.clicks,
      sortOrder: l.sortOrder,
      isActive: l.isActive,
      createdAt: l.createdAt.toISOString(),
    })),
    products: products.map((p: any) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      currency: p.currency,
      imageUrl: p.imageUrl,
      fileUrl: p.fileUrl,
      salesCount: p.salesCount,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

export default router;
