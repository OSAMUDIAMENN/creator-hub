import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const featureFlagsTable = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  status: text("status").notNull().default("enabled"),
  category: text("category").notNull().default("general"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlagsTable).omit({ id: true, updatedAt: true });
export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
