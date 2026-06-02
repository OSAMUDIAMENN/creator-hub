import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const aiSavedGenerationsTable = pgTable("ai_saved_generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiSavedGeneration = typeof aiSavedGenerationsTable.$inferSelect;
