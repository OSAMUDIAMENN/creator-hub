import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, profilesTable, marketplaceListingsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

router.get("/marketplace", async (req, res): Promise<void> => {
  const category = req.query.category as string | undefined;
  const serviceType = req.query.serviceType as string | undefined;

  const conditions = [eq(marketplaceListingsTable.isActive, true)];
  if (category) conditions.push(eq(marketplaceListingsTable.category, category));
  if (serviceType) conditions.push(eq(marketplaceListingsTable.serviceType, serviceType));

  const listings = await db
    .select({
      id: marketplaceListingsTable.id,
      sellerId: marketplaceListingsTable.sellerId,
      category: marketplaceListingsTable.category,
      serviceType: marketplaceListingsTable.serviceType,
      title: marketplaceListingsTable.title,
      description: marketplaceListingsTable.description,
      price: marketplaceListingsTable.price,
      currency: marketplaceListingsTable.currency,
      deliveryDays: marketplaceListingsTable.deliveryDays,
      imageUrl: marketplaceListingsTable.imageUrl,
      fileUrl: marketplaceListingsTable.fileUrl,
      totalOrders: marketplaceListingsTable.totalOrders,
      rating: marketplaceListingsTable.rating,
      createdAt: marketplaceListingsTable.createdAt,
      sellerName: profilesTable.name,
      sellerUsername: profilesTable.username,
      sellerProfileImage: profilesTable.profileImage,
    })
    .from(marketplaceListingsTable)
    .innerJoin(profilesTable, eq(marketplaceListingsTable.sellerId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(desc(marketplaceListingsTable.totalOrders));

  res.json(listings.map(format));
});

router.get("/marketplace/my", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const listings = await db
    .select()
    .from(marketplaceListingsTable)
    .where(eq(marketplaceListingsTable.sellerId, profile.id))
    .orderBy(desc(marketplaceListingsTable.createdAt));

  res.json(listings.map(format));
});

router.get("/marketplace/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [listing] = await db
    .select({
      id: marketplaceListingsTable.id,
      sellerId: marketplaceListingsTable.sellerId,
      category: marketplaceListingsTable.category,
      serviceType: marketplaceListingsTable.serviceType,
      title: marketplaceListingsTable.title,
      description: marketplaceListingsTable.description,
      price: marketplaceListingsTable.price,
      currency: marketplaceListingsTable.currency,
      deliveryDays: marketplaceListingsTable.deliveryDays,
      imageUrl: marketplaceListingsTable.imageUrl,
      fileUrl: marketplaceListingsTable.fileUrl,
      totalOrders: marketplaceListingsTable.totalOrders,
      rating: marketplaceListingsTable.rating,
      isActive: marketplaceListingsTable.isActive,
      createdAt: marketplaceListingsTable.createdAt,
      sellerName: profilesTable.name,
      sellerUsername: profilesTable.username,
      sellerProfileImage: profilesTable.profileImage,
    })
    .from(marketplaceListingsTable)
    .innerJoin(profilesTable, eq(marketplaceListingsTable.sellerId, profilesTable.id))
    .where(eq(marketplaceListingsTable.id, id));

  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  res.json(format(listing));
});

router.post("/marketplace", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { category, serviceType, title, description, price, currency, deliveryDays, imageUrl, fileUrl } = req.body as {
    category: string; serviceType: string; title: string; description: string;
    price: number; currency?: string; deliveryDays?: number; imageUrl?: string; fileUrl?: string;
  };

  if (!category || !serviceType || !title || !description || price == null) {
    res.status(400).json({ error: "category, serviceType, title, description, and price are required" }); return;
  }

  const [listing] = await db.insert(marketplaceListingsTable).values({
    sellerId: profile.id,
    category,
    serviceType,
    title,
    description,
    price,
    currency: currency ?? "NGN",
    deliveryDays: deliveryDays ?? 3,
    imageUrl: imageUrl ?? null,
    fileUrl: fileUrl ?? null,
  }).returning();

  res.status(201).json(format(listing));
});

router.put("/marketplace/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(String(req.params.id), 10);
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const [existing] = await db.select().from(marketplaceListingsTable).where(
    and(eq(marketplaceListingsTable.id, id), eq(marketplaceListingsTable.sellerId, profile.id))
  );
  if (!existing) { res.status(404).json({ error: "Listing not found" }); return; }

  const { title, description, price, deliveryDays, imageUrl, fileUrl, isActive, category, serviceType } = req.body as Record<string, unknown>;
  const [updated] = await db.update(marketplaceListingsTable)
    .set({
      ...(title !== undefined && { title: title as string }),
      ...(description !== undefined && { description: description as string }),
      ...(price !== undefined && { price: price as number }),
      ...(deliveryDays !== undefined && { deliveryDays: deliveryDays as number }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl as string }),
      ...(fileUrl !== undefined && { fileUrl: fileUrl as string }),
      ...(isActive !== undefined && { isActive: isActive as boolean }),
      ...(category !== undefined && { category: category as string }),
      ...(serviceType !== undefined && { serviceType: serviceType as string }),
    })
    .where(eq(marketplaceListingsTable.id, id))
    .returning();

  res.json(format(updated));
});

router.delete("/marketplace/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(String(req.params.id), 10);
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  await db.delete(marketplaceListingsTable).where(
    and(eq(marketplaceListingsTable.id, id), eq(marketplaceListingsTable.sellerId, profile.id))
  );
  res.status(204).send();
});

function format(l: Record<string, unknown>) {
  return {
    ...l,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
  };
}

export default router;
