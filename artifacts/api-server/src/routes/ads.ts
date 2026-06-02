import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, adsTable, adImpressionsTable, profilesTable, walletsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

router.get("/public-ads/active", async (req, res): Promise<void> => {
  const { creatorUsername } = req.query as { creatorUsername?: string };

  const [ad] = await db
    .select()
    .from(adsTable)
    .where(eq(adsTable.isActive, true))
    .limit(1);

  if (!ad) { res.json(null); return; }

  if (creatorUsername) {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.username, creatorUsername));

    if (profile) {
      await db.insert(adImpressionsTable).values({ adId: ad.id, creatorId: profile.id });

      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, profile.id));

      if (wallet) {
        await db
          .update(walletsTable)
          .set({ balance: wallet.balance + ad.earningsPerImpression })
          .where(eq(walletsTable.id, wallet.id));
      }
    }
  }

  res.json({
    id: ad.id,
    title: ad.title,
    description: ad.description,
    imageUrl: ad.imageUrl,
    ctaUrl: ad.ctaUrl,
    ctaText: ad.ctaText,
    advertiserName: ad.advertiserName,
  });
});

router.get("/ads/earnings", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, userId));

  if (!profile) { res.json({ totalImpressions: 0, totalEarningsKobo: 0 }); return; }

  const impressions = await db
    .select()
    .from(adImpressionsTable)
    .where(eq(adImpressionsTable.creatorId, profile.id));

  const adIds = [...new Set(impressions.map((i) => i.adId))];
  let totalEarningsKobo = 0;
  for (const adId of adIds) {
    const [ad] = await db.select().from(adsTable).where(eq(adsTable.id, adId));
    if (ad) {
      const count = impressions.filter((i) => i.adId === adId).length;
      totalEarningsKobo += count * ad.earningsPerImpression;
    }
  }

  res.json({ totalImpressions: impressions.length, totalEarningsKobo });
});

router.get("/admin/ads", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const ads = await db.select().from(adsTable);
  res.json(ads.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    imageUrl: a.imageUrl,
    ctaUrl: a.ctaUrl,
    ctaText: a.ctaText,
    advertiserName: a.advertiserName,
    isActive: a.isActive,
    earningsPerImpression: a.earningsPerImpression,
    createdAt: a.createdAt.toISOString(),
  })));
});

router.post("/admin/ads", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { title, description, imageUrl, ctaUrl, ctaText, advertiserName, earningsPerImpression } = req.body as {
    title: string; description?: string; imageUrl?: string;
    ctaUrl: string; ctaText?: string; advertiserName: string; earningsPerImpression?: number;
  };

  if (!title || !ctaUrl || !advertiserName) {
    res.status(400).json({ error: "title, ctaUrl, and advertiserName are required" });
    return;
  }

  const [ad] = await db
    .insert(adsTable)
    .values({
      title,
      description: description ?? null,
      imageUrl: imageUrl ?? null,
      ctaUrl,
      ctaText: ctaText ?? "Learn More",
      advertiserName,
      earningsPerImpression: earningsPerImpression ?? 50,
    })
    .returning();

  res.status(201).json(ad);
});

router.patch("/admin/ads/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const updates: Record<string, unknown> = {};
  const body = req.body as Record<string, unknown>;

  for (const key of ["title", "description", "imageUrl", "ctaUrl", "ctaText", "advertiserName", "isActive", "earningsPerImpression"]) {
    if (body[key] !== undefined) updates[key === "imageUrl" ? "imageUrl" : key === "earningsPerImpression" ? "earningsPerImpression" : key] = body[key];
  }

  const [ad] = await db.update(adsTable).set(updates).where(eq(adsTable.id, id)).returning();
  if (!ad) { res.status(404).json({ error: "Ad not found" }); return; }
  res.json(ad);
});

router.delete("/admin/ads/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id as string, 10);
  await db.delete(adImpressionsTable).where(eq(adImpressionsTable.adId, id));
  await db.delete(adsTable).where(eq(adsTable.id, id));
  res.status(204).send();
});

export default router;
