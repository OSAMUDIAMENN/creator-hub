import { Router, type IRouter } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { db, profilesTable, bookingsTable, marketplaceListingsTable, notificationsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

async function getProfile(clerkId: string) {
  const [p] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  return p ?? null;
}

router.get("/bookings/my", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await getProfile(userId);
  if (!profile) { res.json([]); return; }

  const rows = await db
    .select({
      id: bookingsTable.id,
      listingId: bookingsTable.listingId,
      buyerId: bookingsTable.buyerId,
      sellerId: bookingsTable.sellerId,
      status: bookingsTable.status,
      message: bookingsTable.message,
      requirements: bookingsTable.requirements,
      price: bookingsTable.price,
      currency: bookingsTable.currency,
      sellerNotes: bookingsTable.sellerNotes,
      createdAt: bookingsTable.createdAt,
      updatedAt: bookingsTable.updatedAt,
      listingTitle: marketplaceListingsTable.title,
      listingCategory: marketplaceListingsTable.category,
      listingServiceType: marketplaceListingsTable.serviceType,
      sellerName: profilesTable.name,
      sellerUsername: profilesTable.username,
      sellerProfileImage: profilesTable.profileImage,
    })
    .from(bookingsTable)
    .innerJoin(marketplaceListingsTable, eq(bookingsTable.listingId, marketplaceListingsTable.id))
    .innerJoin(profilesTable, eq(bookingsTable.sellerId, profilesTable.id))
    .where(eq(bookingsTable.buyerId, profile.id))
    .orderBy(desc(bookingsTable.createdAt));

  res.json(rows.map(fmt));
});

router.get("/bookings/orders", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await getProfile(userId);
  if (!profile) { res.json([]); return; }

  const buyers = db.select({ id: profilesTable.id, name: profilesTable.name, username: profilesTable.username, profileImage: profilesTable.profileImage }).from(profilesTable);

  const rows = await db
    .select({
      id: bookingsTable.id,
      listingId: bookingsTable.listingId,
      buyerId: bookingsTable.buyerId,
      sellerId: bookingsTable.sellerId,
      status: bookingsTable.status,
      message: bookingsTable.message,
      requirements: bookingsTable.requirements,
      price: bookingsTable.price,
      currency: bookingsTable.currency,
      sellerNotes: bookingsTable.sellerNotes,
      createdAt: bookingsTable.createdAt,
      updatedAt: bookingsTable.updatedAt,
      listingTitle: marketplaceListingsTable.title,
      listingCategory: marketplaceListingsTable.category,
      listingServiceType: marketplaceListingsTable.serviceType,
    })
    .from(bookingsTable)
    .innerJoin(marketplaceListingsTable, eq(bookingsTable.listingId, marketplaceListingsTable.id))
    .where(eq(bookingsTable.sellerId, profile.id))
    .orderBy(desc(bookingsTable.createdAt));

  res.json(rows.map(fmt));
});

router.post("/bookings", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await getProfile(userId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { listingId, message, requirements } = req.body as {
    listingId: number; message?: string; requirements?: string;
  };
  if (!listingId) { res.status(400).json({ error: "listingId is required" }); return; }

  const [listing] = await db.select().from(marketplaceListingsTable).where(
    and(eq(marketplaceListingsTable.id, listingId), eq(marketplaceListingsTable.isActive, true))
  );
  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.sellerId === profile.id) { res.status(400).json({ error: "Cannot book your own listing" }); return; }

  const [booking] = await db.insert(bookingsTable).values({
    listingId,
    buyerId: profile.id,
    sellerId: listing.sellerId,
    price: listing.price,
    currency: listing.currency,
    message: message ?? null,
    requirements: requirements ?? null,
  }).returning();

  await db.insert(notificationsTable).values({
    userId: listing.sellerId,
    type: "booking",
    title: "New Booking Request",
    message: `${profile.name} has requested your service: "${listing.title}"`,
    data: JSON.stringify({ bookingId: booking.id, listingId, buyerName: profile.name }),
  });

  res.status(201).json(fmt(booking));
});

router.patch("/bookings/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await getProfile(userId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const [booking] = await db.select().from(bookingsTable).where(
    and(eq(bookingsTable.id, id), or(eq(bookingsTable.sellerId, profile.id), eq(bookingsTable.buyerId, profile.id)))
  );
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const { status, sellerNotes } = req.body as { status?: string; sellerNotes?: string };

  const isSeller = booking.sellerId === profile.id;
  const isBuyer = booking.buyerId === profile.id;

  const sellerAllowed = ["accepted", "rejected", "completed"];
  const buyerAllowed = ["cancelled"];

  if (status) {
    if (isSeller && !sellerAllowed.includes(status)) {
      res.status(400).json({ error: `Sellers can set status to: ${sellerAllowed.join(", ")}` }); return;
    }
    if (isBuyer && !buyerAllowed.includes(status)) {
      res.status(400).json({ error: `Buyers can set status to: ${buyerAllowed.join(", ")}` }); return;
    }
  }

  const [updated] = await db.update(bookingsTable)
    .set({
      ...(status !== undefined && { status }),
      ...(sellerNotes !== undefined && isSeller && { sellerNotes }),
      updatedAt: new Date(),
    })
    .where(eq(bookingsTable.id, id))
    .returning();

  if (status) {
    const notifyUserId = isSeller ? booking.buyerId : booking.sellerId;
    const notifyTitle = status === "accepted" ? "Booking Accepted" :
      status === "rejected" ? "Booking Rejected" :
      status === "completed" ? "Order Completed" :
      "Booking Update";
    await db.insert(notificationsTable).values({
      userId: notifyUserId,
      type: "booking",
      title: notifyTitle,
      message: `Your booking #${id} has been marked as ${status}.`,
      data: JSON.stringify({ bookingId: id, status }),
    });
  }

  res.json(fmt(updated));
});

function fmt(b: Record<string, unknown>) {
  return {
    ...b,
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
    updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : b.updatedAt,
  };
}

export default router;
