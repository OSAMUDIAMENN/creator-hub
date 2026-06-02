import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { teamsTable } from "./teams";

export const teamMessagesTable = pgTable("team_messages", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamActivityTable = pgTable("team_activity", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  description: text("description").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamMessageSchema = createInsertSchema(teamMessagesTable).omit({ id: true, createdAt: true, senderId: true });
export type TeamMessage = typeof teamMessagesTable.$inferSelect;
export type InsertTeamMessage = z.infer<typeof insertTeamMessageSchema>;

export const insertTeamActivitySchema = createInsertSchema(teamActivityTable).omit({ id: true, createdAt: true });
export type TeamActivity = typeof teamActivityTable.$inferSelect;
