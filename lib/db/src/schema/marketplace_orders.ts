import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";
import { marketplaceListingsTable } from "./marketplace";

export const marketplaceOrdersTable = pgTable("marketplace_orders", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => marketplaceListingsTable.id, { onDelete: "restrict" }),
  buyerId: integer("buyer_id").references(() => profilesTable.id, { onDelete: "set null" }),
  sellerId: integer("seller_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("NGN"),
  reference: text("reference").notNull().unique(),
  status: text("status").notNull().default("paid"),
  message: text("message"),
  requirements: text("requirements"),
  sellerNotes: text("seller_notes"),
  deliveryDays: integer("delivery_days"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundReference: text("refund_reference"),
  disputedAt: timestamp("disputed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type MarketplaceOrder = typeof marketplaceOrdersTable.$inferSelect;
