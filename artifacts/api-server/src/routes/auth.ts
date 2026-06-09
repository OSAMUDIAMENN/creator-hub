import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, notificationsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

// JIT user provisioning — called after sign-in/sign-up to create a profile if needed
router.post("/auth/provision", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, email, username } = req.body as { name?: string; email?: string; username?: string };

  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, userId));

  if (existing) {
    res.json({
      id: existing.id,
      clerkId: existing.clerkId,
      name: existing.name,
      username: existing.username,
      email: existing.email,
      bio: existing.bio,
      profileImage: existing.profileImage,
      whatsappNumber: existing.whatsappNumber,
      theme: existing.theme,
      createdAt: existing.createdAt.toISOString(),
    });
    return;
  }

  // Generate unique username from email or name
  const baseUsername = (username ?? email?.split("@")[0] ?? `user_${userId.slice(0, 8)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");

  let finalUsername = baseUsername;
  let attempt = 0;
  while (true) {
    const [conflict] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.username, finalUsername));
    if (!conflict) break;
    attempt++;
    finalUsername = `${baseUsername}_${attempt}`;
  }

  const [profile] = await db
    .insert(profilesTable)
    .values({
      clerkId: userId,
      name: name ?? finalUsername,
      username: finalUsername,
      email: email ?? `${userId}@placeholder.com`,
    })
    .returning();

  await db.insert(notificationsTable).values({
    userId: profile.id,
    type: "welcome",
    title: "Welcome to CreatorHub! 🎉",
    message: "Your creator profile is ready. Add your links, upload products, and start growing your audience.",
    data: JSON.stringify({ isNew: true }),
  });

  res.status(201).json({
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

export default router;
