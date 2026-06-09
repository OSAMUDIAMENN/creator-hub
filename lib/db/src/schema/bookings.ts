import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  requirements: text("requirements"),
  price: integer("price").notNull(),
  currency: text("currency").notNull().default("NGN"),
  sellerNotes: text("seller_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
