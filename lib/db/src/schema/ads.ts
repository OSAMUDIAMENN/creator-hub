import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adsTable = pgTable("ads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  ctaUrl: text("cta_url").notNull(),
  ctaText: text("cta_text").notNull().default("Learn More"),
  advertiserName: text("advertiser_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  earningsPerImpression: integer("earnings_per_impression_kobo").notNull().default(50),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adImpressionsTable = pgTable("ad_impressions", {
  id: serial("id").primaryKey(),
  adId: integer("ad_id").notNull(),
  creatorId: integer("creator_id").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdSchema = createInsertSchema(adsTable).omit({ id: true, createdAt: true });
export type InsertAd = z.infer<typeof insertAdSchema>;
export type Ad = typeof adsTable.$inferSelect;
