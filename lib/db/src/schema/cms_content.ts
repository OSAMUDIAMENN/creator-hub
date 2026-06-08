import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const cmsContentTable = pgTable("cms_content", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default(""),
  excerpt: text("excerpt"),
  authorId: integer("author_id").references(() => profilesTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCmsContentSchema = createInsertSchema(cmsContentTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CmsContent = typeof cmsContentTable.$inferSelect;
export type InsertCmsContent = z.infer<typeof insertCmsContentSchema>;
