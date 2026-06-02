import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { teamsTable } from "./teams";

export const teamInvitationsTable = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  role: text("role").notNull().default("editor"),
  token: text("token").notNull().unique(),
  invitedBy: integer("invited_by").notNull().references(() => profilesTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitationsTable).omit({
  id: true, createdAt: true, acceptedAt: true,
});
export type TeamInvitation = typeof teamInvitationsTable.$inferSelect;
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
