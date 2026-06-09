import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const productPurchasesTable = pgTable("product_purchases", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("NGN"),
  reference: text("reference").notNull().unique(),
  status: text("status").notNull().default("completed"),
  downloadCount: integer("download_count").notNull().default(0),
  maxDownloads: integer("max_downloads"),
  lastDownloadAt: timestamp("last_download_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundReference: text("refund_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductPurchaseSchema = createInsertSchema(productPurchasesTable).omit({ id: true, createdAt: true });
export type ProductPurchase = typeof productPurchasesTable.$inferSelect;
export type InsertProductPurchase = z.infer<typeof insertProductPurchaseSchema>;
