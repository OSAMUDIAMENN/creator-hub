import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  refereeId: integer("referee_id").references(() => profilesTable.id, { onDelete: "set null" }),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | converted | rewarded
  rewardAmount: numeric("reward_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  refereePlan: text("referee_plan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
});

export type Referral = typeof referralsTable.$inferSelect;
