import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const PLAN_FREE = "free";
export const PLAN_PRO = "pro";
export const PLAN_BUSINESS = "business";
export const PLANS = [PLAN_FREE, PLAN_PRO, PLAN_BUSINESS] as const;
export type Plan = typeof PLANS[number];

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default(PLAN_FREE),
  status: text("status").notNull().default("active"),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  paystackCustomerCode: text("paystack_customer_code"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
