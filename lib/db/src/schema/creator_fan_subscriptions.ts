import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";
import { creatorSubscriptionTiersTable } from "./creator_subscription_tiers";

export const creatorFanSubscriptionsTable = pgTable("creator_fan_subscriptions", {
  id: serial("id").primaryKey(),
  tierId: integer("tier_id").notNull().references(() => creatorSubscriptionTiersTable.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  fanEmail: text("fan_email").notNull(),
  fanName: text("fan_name"),
  fanUserId: integer("fan_user_id").references(() => profilesTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  reference: text("reference").notNull().unique(),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type CreatorFanSubscription = typeof creatorFanSubscriptionsTable.$inferSelect;
