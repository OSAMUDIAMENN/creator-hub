import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const creatorVerificationsTable = pgTable("creator_verifications", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique(),
  status: text("status").notNull().default("pending"),
  niche: text("niche"),
  socialProof: text("social_proof"),
  followerCount: text("follower_count"),
  reason: text("reason"),
  isVerified: boolean("is_verified").notNull().default(false),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});
