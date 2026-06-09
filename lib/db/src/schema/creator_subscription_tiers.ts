import { pgTable, serial, integer, numeric, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const creatorSubscriptionTiersTable = pgTable("creator_subscription_tiers", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("NGN"),
  interval: text("interval").notNull().default("monthly"),
  perks: text("perks"),
  isActive: boolean("is_active").notNull().default(true),
  maxSubscribers: integer("max_subscribers"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type CreatorSubscriptionTier = typeof creatorSubscriptionTiersTable.$inferSelect;
