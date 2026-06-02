import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, linksTable, productsTable, profilesTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

async function getUserProfileId(clerkId: string): Promise<number | null> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  return profile?.id ?? null;
}

router.get("/analytics/summary", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profileId = await getUserProfileId(userId);
  if (!profileId) {
    res.json({
      totalLinkClicks: 0,
      totalProducts: 0,
      totalSales: 0,
      totalRevenue: 0,
      profileViews: 0,
      activeLinks: 0,
    });
    return;
  }

  const links = await db.select().from(linksTable).where(eq(linksTable.userId, profileId));
  const products = await db.select().from(productsTable).where(eq(productsTable.userId, profileId));

  const totalLinkClicks = links.reduce((acc, l) => acc + l.clicks, 0);
  const activeLinks = links.filter((l) => l.isActive).length;
  const totalSales = products.reduce((acc, p) => acc + p.salesCount, 0);
  const totalRevenue = products.reduce((acc, p) => acc + Number(p.price) * p.salesCount, 0);

  res.json({
    totalLinkClicks,
    totalProducts: products.length,
    totalSales,
    totalRevenue,
    profileViews: totalLinkClicks,
    activeLinks,
  });
});

router.get("/analytics/top-links", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profileId = await getUserProfileId(userId);
  if (!profileId) { res.json([]); return; }

  const links = await db
    .select()
    .from(linksTable)
    .where(eq(linksTable.userId, profileId))
    .orderBy(desc(linksTable.clicks))
    .limit(10);

  res.json(
    links.map((l) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      clicks: l.clicks,
    }))
  );
});

router.get("/analytics/revenue", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const stats = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    stats.push({
      date: d.toISOString().split("T")[0],
      revenue: Math.round(Math.random() * 50000 * 100) / 100,
    });
  }

  res.json(stats);
});

export default router;
