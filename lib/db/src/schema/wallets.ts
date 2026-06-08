import { pgTable, serial, integer, numeric, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => profilesTable.id, { onDelete: "cascade" }),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalEarned: numeric("total_earned", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalWithdrawn: numeric("total_withdrawn", { precision: 12, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("NGN"),
  isFrozen: boolean("is_frozen").notNull().default(false),
  frozenReason: text("frozen_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Wallet = typeof walletsTable.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
