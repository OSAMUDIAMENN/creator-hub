import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("NGN"),
  status: text("status").notNull().default("pending"), // "pending" | "processing" | "approved" | "rejected" | "completed"
  paymentMethod: text("payment_method").notNull(), // "bank_transfer" | "paystack" | "flutterwave" | "crypto"
  accountDetails: text("account_details").notNull(), // JSON string: bank name, account no, etc.
  adminNotes: text("admin_notes"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawalsTable).omit({ id: true, createdAt: true, updatedAt: true, processedAt: true });
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
