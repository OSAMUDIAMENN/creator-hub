import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, profilesTable, creatorVerificationsTable, notificationsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

async function getProfile(clerkId: string) {
  const [p] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  return p ?? null;
}

async function requireAdmin(clerkId: string): Promise<boolean> {
  const [p] = await db.select({ isAdmin: profilesTable.isAdmin }).from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  return p?.isAdmin === true;
}

router.get("/verify", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await getProfile(userId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const [ver] = await db.select().from(creatorVerificationsTable).where(eq(creatorVerificationsTable.profileId, profile.id));
  res.json(ver ? fmt(ver) : null);
});

router.post("/verify/request", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await getProfile(userId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { niche, socialProof, followerCount } = req.body as {
    niche?: string; socialProof?: string; followerCount?: string;
  };

  const [existing] = await db.select().from(creatorVerificationsTable).where(eq(creatorVerificationsTable.profileId, profile.id));

  if (existing?.status === "approved") {
    res.status(400).json({ error: "You are already verified" }); return;
  }
  if (existing?.status === "pending") {
    res.status(400).json({ error: "You already have a pending verification request" }); return;
  }

  if (existing) {
    const [updated] = await db.update(creatorVerificationsTable)
      .set({ status: "pending", niche: niche ?? null, socialProof: socialProof ?? null, followerCount: followerCount ?? null, reason: null, submittedAt: new Date(), reviewedAt: null })
      .where(eq(creatorVerificationsTable.profileId, profile.id))
      .returning();
    res.json(fmt(updated));
  } else {
    const [created] = await db.insert(creatorVerificationsTable)
      .values({ profileId: profile.id, niche: niche ?? null, socialProof: socialProof ?? null, followerCount: followerCount ?? null })
      .returning();
    res.status(201).json(fmt(created));
  }
});

router.get("/admin/verifications", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!(await requireAdmin(userId))) { res.status(403).json({ error: "Forbidden" }); return; }

  const rows = await db
    .select({
      id: creatorVerificationsTable.id,
      profileId: creatorVerificationsTable.profileId,
      status: creatorVerificationsTable.status,
      niche: creatorVerificationsTable.niche,
      socialProof: creatorVerificationsTable.socialProof,
      followerCount: creatorVerificationsTable.followerCount,
      isVerified: creatorVerificationsTable.isVerified,
      reason: creatorVerificationsTable.reason,
      submittedAt: creatorVerificationsTable.submittedAt,
      reviewedAt: creatorVerificationsTable.reviewedAt,
      name: profilesTable.name,
      username: profilesTable.username,
      email: profilesTable.email,
      profileImage: profilesTable.profileImage,
    })
    .from(creatorVerificationsTable)
    .innerJoin(profilesTable, eq(creatorVerificationsTable.profileId, profilesTable.id))
    .orderBy(desc(creatorVerificationsTable.submittedAt));

  res.json(rows.map(r => ({ ...r, submittedAt: r.submittedAt?.toISOString(), reviewedAt: r.reviewedAt?.toISOString() ?? null })));
});

router.patch("/admin/verifications/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!(await requireAdmin(userId))) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const { status, reason } = req.body as { status: "approved" | "rejected"; reason?: string };
  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be approved or rejected" }); return;
  }

  const [ver] = await db.select().from(creatorVerificationsTable).where(eq(creatorVerificationsTable.id, id));
  if (!ver) { res.status(404).json({ error: "Not found" }); return; }

  const isVerified = status === "approved";
  const [updated] = await db.update(creatorVerificationsTable)
    .set({ status, isVerified, reason: reason ?? null, reviewedAt: new Date() })
    .where(eq(creatorVerificationsTable.id, id))
    .returning();

  await db.insert(notificationsTable).values({
    userId: ver.profileId,
    type: "verification",
    title: isVerified ? "🎉 Verification Approved!" : "Verification Update",
    message: isVerified
      ? "Congratulations! Your creator verification has been approved. Your profile now shows a verified badge."
      : `Your verification request was not approved${reason ? `: ${reason}` : "."}`,
    data: JSON.stringify({ verificationId: id, status }),
  });

  if (isVerified) {
    await db.update(profilesTable).set({ role: "verified_creator" }).where(eq(profilesTable.id, ver.profileId));
  }

  res.json(fmt(updated));
});

function fmt(v: Record<string, unknown>) {
  return {
    ...v,
    submittedAt: v.submittedAt instanceof Date ? v.submittedAt.toISOString() : v.submittedAt,
    reviewedAt: v.reviewedAt instanceof Date ? (v.reviewedAt as Date).toISOString() : v.reviewedAt ?? null,
  };
}

export default router;
