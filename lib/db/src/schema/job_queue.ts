import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const jobQueueTable = pgTable("job_queue", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type JobQueue = typeof jobQueueTable.$inferSelect;
