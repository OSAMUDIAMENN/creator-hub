import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, adsTable, adImpressionsTable, profilesTable, walletsTable, transactionsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

function detectDevice(ua: string): string {
  if (!ua) return "unknown";
  const u = ua.toLowerCase();
  if (u.includes("mobile") || u.includes("android") || u.includes("iphone")) return "mobile";
  if (u.includes("tablet") || u.includes("ipad")) return "tablet";
  return "desktop";
}

router.get("/public-ads/active", async (req, res): Promise<void> => {
  const { creatorUsername, limit: limitParam } = req.query as { creatorUsername?: string; limit?: string };
  const limit = Math.min(parseInt(limitParam ?? "1", 10) || 1, 4);

  const activeAds = await db
    .select()
    .from(adsTable)
    .where(eq(adsTable.isActive, true))
    .orderBy(desc(adsTable.createdAt))
    .limit(limit);

  if (activeAds.length === 0) {
    res.json(limit === 1 ? null : []);
    return;
  }

  if (creatorUsername) {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.username, creatorUsername));

    if (profile) {
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? null;
      const userAgent = (req.headers["user-agent"] as string) ?? null;
      const deviceType = userAgent ? detectDevice(userAgent) : "unknown";

      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, profile.id));

      for (const ad of activeAds) {
        await db.insert(adImpressionsTable).values({
          adId: ad.id,
          creatorId: profile.id,
          ipAddress: ipAddress ? ipAddress.slice(0, 45) : null,
          userAgent: userAgent ? userAgent.slice(0, 512) : null,
          deviceType,
        });

        const earningsNgn = ad.earningsPerImpression / 100;

        if (wallet) {
          await db
            .update(walletsTable)
            .set({
              balance: String(Number(wallet.balance) + earningsNgn),
              totalEarned: String(Number(wallet.totalEarned) + earningsNgn),
            })
            .where(eq(walletsTable.id, wallet.id));
        } else {
          await db.insert(walletsTable).values({
            userId: profile.id,
            balance: String(earningsNgn),
            totalEarned: String(earningsNgn),
            totalWithdrawn: "0.00",
            currency: "NGN",
          });
        }

        await db.insert(transactionsTable).values({
          userId: profile.id,
          type: "earning",
          amount: String(earningsNgn),
          currency: "NGN",
          description: `Ad impression: ${ad.title} (${ad.advertiserName})`,
          reference: `AD-${ad.id}-${profile.id}-${Date.now()}`,
          status: "completed",
          metadata: JSON.stringify({ adId: ad.id, deviceType, source: "ad_impression" }),
        });
      }
    }
  }

  const formatted = activeAds.map((ad) => ({
    id: ad.id,
    title: ad.title,
    description: ad.description,
    imageUrl: ad.imageUrl,
    ctaUrl: ad.ctaUrl,
    ctaText: ad.ctaText,
    advertiserName: ad.advertiserName,
  }));

  res.json(limit === 1 ? (formatted[0] ?? null) : formatted);
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

  const deviceBreakdown: Record<string, number> = {};
  for (const imp of impressions) {
    const d = imp.deviceType ?? "unknown";
    deviceBreakdown[d] = (deviceBreakdown[d] ?? 0) + 1;
  }

  res.json({ totalImpressions: impressions.length, totalEarningsKobo, deviceBreakdown });
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
    if (body[key] !== undefined) updates[key] = body[key];
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
