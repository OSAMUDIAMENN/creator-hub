import { eq, and, lte, isNull } from "drizzle-orm";
import { db, postsTable, profilesTable, notificationsTable } from "@workspace/db";
import { logger } from "./logger";

let schedulerInterval: NodeJS.Timeout | null = null;

async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  data?: object,
) {
  await db.insert(notificationsTable).values({
    userId,
    type,
    title,
    message,
    data: data ? JSON.stringify(data) : null,
  });
}

async function processScheduledPosts() {
  const now = new Date();

  const duePosts = await db
    .select()
    .from(postsTable)
    .where(
      and(
        eq(postsTable.status, "scheduled"),
        lte(postsTable.scheduledDate, now),
        isNull(postsTable.publishedAt),
      ),
    );

  if (duePosts.length === 0) return;

  logger.info({ count: duePosts.length }, "Processing scheduled posts");

  for (const post of duePosts) {
    try {
      await db
        .update(postsTable)
        .set({
          status: "published",
          publishedAt: now,
          publishError: null,
        })
        .where(eq(postsTable.id, post.id));

      await createNotification(
        post.userId,
        "post_published",
        "Post published!",
        `Your ${post.platform} post "${post.title}" has been published successfully.`,
        { postId: post.id, platform: post.platform },
      );

      logger.info({ postId: post.id, platform: post.platform }, "Post published by scheduler");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      await db
        .update(postsTable)
        .set({ publishError: errMsg })
        .where(eq(postsTable.id, post.id));

      await createNotification(
        post.userId,
        "post_failed",
        "Post failed to publish",
        `Your ${post.platform} post "${post.title}" could not be published: ${errMsg}`,
        { postId: post.id, platform: post.platform, error: errMsg },
      );

      logger.error({ postId: post.id, err }, "Failed to publish scheduled post");
    }
  }
}

async function sendUpcomingReminders() {
  const in30min = new Date(Date.now() + 30 * 60 * 1000);
  const in31min = new Date(Date.now() + 31 * 60 * 1000);

  const upcoming = await db
    .select()
    .from(postsTable)
    .where(
      and(
        eq(postsTable.status, "scheduled"),
        lte(postsTable.scheduledDate, in31min),
      ),
    );

  for (const post of upcoming) {
    const scheduledAt = post.scheduledDate;
    if (!scheduledAt) continue;
    const diffMs = scheduledAt.getTime() - Date.now();
    if (diffMs >= 29 * 60 * 1000 && diffMs <= 31 * 60 * 1000) {
      await createNotification(
        post.userId,
        "post_reminder",
        "Post publishing soon",
        `Your ${post.platform} post "${post.title}" is scheduled to publish in 30 minutes.`,
        { postId: post.id, platform: post.platform },
      ).catch(() => {});
    }
  }
}

export function startScheduler() {
  if (schedulerInterval) return;

  logger.info("Content scheduler started (60s interval)");

  schedulerInterval = setInterval(async () => {
    try {
      await processScheduledPosts();
      await sendUpcomingReminders();
    } catch (err) {
      logger.error({ err }, "Scheduler tick error");
    }
  }, 60_000);

  schedulerInterval.unref();
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
