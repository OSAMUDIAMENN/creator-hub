import { pgTable, serial, integer, text, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const MARKETPLACE_CATEGORIES = [
  "video_editing",
  "graphic_design",
  "script_writing",
  "social_media_management",
] as const;

export const MARKETPLACE_SERVICE_TYPES = [
  "service",
  "shoutout",
  "template",
  "consultation",
] as const;

export type MarketplaceCategory = typeof MARKETPLACE_CATEGORIES[number];
export type MarketplaceServiceType = typeof MARKETPLACE_SERVICE_TYPES[number];

export const marketplaceListingsTable = pgTable("marketplace_listings", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  serviceType: text("service_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  currency: text("currency").notNull().default("NGN"),
  deliveryDays: integer("delivery_days").notNull().default(3),
  imageUrl: text("image_url"),
  fileUrl: text("file_url"),
  isActive: boolean("is_active").notNull().default(true),
  totalOrders: integer("total_orders").notNull().default(0),
  rating: real("rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListingsTable).omit({
  id: true, createdAt: true, updatedAt: true, totalOrders: true, rating: true, sellerId: true,
});
export type MarketplaceListing = typeof marketplaceListingsTable.$inferSelect;
export type InsertMarketplaceListing = z.infer<typeof insertMarketplaceListingSchema>;
