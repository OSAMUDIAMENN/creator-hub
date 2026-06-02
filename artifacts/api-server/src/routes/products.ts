import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable, profilesTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import {
  CreateProductBody,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  GetProductParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getUserProfileId(clerkId: string): Promise<number | null> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  return profile?.id ?? null;
}

function mapProduct(p: typeof productsTable.$inferSelect) {
  return {
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
  };
}

router.get("/products", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profileId = await getUserProfileId(userId);
  if (!profileId) { res.json([]); return; }

  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.userId, profileId));

  res.json(products.map(mapProduct));
});

router.post("/products", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const profileId = await getUserProfileId(userId);
  if (!profileId) { res.status(404).json({ error: "Profile not found" }); return; }

  const [product] = await db
    .insert(productsTable)
    .values({
      userId: profileId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: String(parsed.data.price),
      currency: parsed.data.currency ?? "NGN",
      imageUrl: parsed.data.imageUrl ?? null,
      fileUrl: parsed.data.fileUrl ?? null,
    })
    .returning();

  res.status(201).json(mapProduct(product));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProductParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  res.json(mapProduct(product));
});

router.patch("/products/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProductParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);
  if (parsed.data.currency !== undefined) updateData.currency = parsed.data.currency;
  if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl;
  if (parsed.data.fileUrl !== undefined) updateData.fileUrl = parsed.data.fileUrl;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(mapProduct(product));
});

router.delete("/products/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProductParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
