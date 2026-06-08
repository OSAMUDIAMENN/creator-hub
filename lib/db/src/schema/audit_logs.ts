import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => profilesTable.id, { onDelete: "set null" }),
  adminEmail: text("admin_email"),
  adminName: text("admin_name"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  changes: text("changes"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
