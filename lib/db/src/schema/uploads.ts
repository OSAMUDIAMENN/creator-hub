import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const uploadsTable = pgTable("uploads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(), // "image" | "pdf" | "video" | "document" | "zip"
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // bytes
  folder: text("folder").notNull().default("general"), // "products" | "profile" | "general"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUploadSchema = createInsertSchema(uploadsTable).omit({ id: true, createdAt: true });
export type Upload = typeof uploadsTable.$inferSelect;
export type InsertUpload = z.infer<typeof insertUploadSchema>;
