import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const AI_TOOLS = ["hook_generator", "script_generator", "thumbnail_analyzer", "content_generator", "ai_chat"] as const;
export type AiTool = typeof AI_TOOLS[number];

export const PLAN_CREDITS: Record<string, number> = {
  free: 20,
  pro: 200,
  business: 1000,
};

export const aiUsageTable = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  tool: text("tool").notNull(),
  creditsUsed: integer("credits_used").notNull().default(1),
  periodMonth: text("period_month").notNull(), // "2025-01" format
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiUsageSchema = createInsertSchema(aiUsageTable).omit({ id: true, createdAt: true });
export type AiUsage = typeof aiUsageTable.$inferSelect;
export type InsertAiUsage = z.infer<typeof insertAiUsageSchema>;
