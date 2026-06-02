import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { teamsTable } from "./teams";

export const TEAM_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type TeamRole = typeof TEAM_ROLES[number];

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("editor"),
  invitedEmail: text("invited_email"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembersTable).omit({ id: true, createdAt: true });
export type TeamMember = typeof teamMembersTable.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
