import { Router, type IRouter } from "express";
import { eq, ilike, and, or } from "drizzle-orm";
import { db, profilesTable, marketplaceListingsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();
  const type = (req.query.type as string | undefined) ?? "all";

  if (!q || q.length < 2) {
    res.json({ creators: [], listings: [] });
    return;
  }

  const pattern = `%${q}%`;

  const [creators, listings] = await Promise.all([
    type === "listings"
      ? Promise.resolve([])
      : db.select({
          id: profilesTable.id,
          name: profilesTable.name,
          username: profilesTable.username,
          bio: profilesTable.bio,
          profileImage: profilesTable.profileImage,
          theme: profilesTable.theme,
        })
        .from(profilesTable)
        .where(
          and(
            eq(profilesTable.isSuspended, false),
            or(ilike(profilesTable.name, pattern), ilike(profilesTable.username, pattern), ilike(profilesTable.bio, pattern))
          )
        )
        .limit(20),

    type === "creators"
      ? Promise.resolve([])
      : db.select({
          id: marketplaceListingsTable.id,
          title: marketplaceListingsTable.title,
          description: marketplaceListingsTable.description,
          category: marketplaceListingsTable.category,
          serviceType: marketplaceListingsTable.serviceType,
          price: marketplaceListingsTable.price,
          currency: marketplaceListingsTable.currency,
          deliveryDays: marketplaceListingsTable.deliveryDays,
          imageUrl: marketplaceListingsTable.imageUrl,
          totalOrders: marketplaceListingsTable.totalOrders,
          rating: marketplaceListingsTable.rating,
          sellerName: profilesTable.name,
          sellerUsername: profilesTable.username,
          sellerProfileImage: profilesTable.profileImage,
        })
        .from(marketplaceListingsTable)
        .innerJoin(profilesTable, eq(marketplaceListingsTable.sellerId, profilesTable.id))
        .where(
          and(
            eq(marketplaceListingsTable.isActive, true),
            or(
              ilike(marketplaceListingsTable.title, pattern),
              ilike(marketplaceListingsTable.description, pattern),
              ilike(marketplaceListingsTable.category, pattern)
            )
          )
        )
        .limit(20),
  ]);

  res.json({ creators, listings });
});

export default router;
