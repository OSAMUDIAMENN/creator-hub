import { pgTable, serial, integer, numeric, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const tipsTable = pgTable("tips", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  tipperName: text("tipper_name"),
  tipperEmail: text("tipper_email"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  message: text("message"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("NGN"),
  reference: text("reference").notNull().unique(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTipSchema = createInsertSchema(tipsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Tip = typeof tipsTable.$inferSelect;
export type InsertTip = z.infer<typeof insertTipSchema>;
