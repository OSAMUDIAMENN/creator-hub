import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, profilesTable, teamsTable, teamMembersTable, teamMessagesTable, teamActivityTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";

const router: IRouter = Router();

async function getProfileAndTeamMembership(clerkId: string, teamId: number) {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) return { profile: null, member: null };
  const [member] = await db.select().from(teamMembersTable).where(
    and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, profile.id))
  );
  return { profile, member };
}

router.get("/teams/:id/messages", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const teamId = parseInt(String(req.params.id), 10);

  const { profile, member } = await getProfileAndTeamMembership(clerkId, teamId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  if (!member) { res.status(403).json({ error: "Not a team member" }); return; }

  const messages = await db
    .select({
      id: teamMessagesTable.id,
      content: teamMessagesTable.content,
      createdAt: teamMessagesTable.createdAt,
      senderId: teamMessagesTable.senderId,
      senderName: profilesTable.name,
      senderUsername: profilesTable.username,
      senderProfileImage: profilesTable.profileImage,
    })
    .from(teamMessagesTable)
    .innerJoin(profilesTable, eq(teamMessagesTable.senderId, profilesTable.id))
    .where(eq(teamMessagesTable.teamId, teamId))
    .orderBy(desc(teamMessagesTable.createdAt))
    .limit(100);

  res.json(messages.reverse().map((m: any) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  })));
});

router.post("/teams/:id/messages", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const teamId = parseInt(String(req.params.id), 10);

  const { profile, member } = await getProfileAndTeamMembership(clerkId, teamId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  if (!member) { res.status(403).json({ error: "Not a team member" }); return; }

  const { content } = req.body as { content: string };
  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }

  const [message] = await db.insert(teamMessagesTable).values({
    teamId,
    senderId: profile.id,
    content: content.trim(),
  }).returning();

  await db.insert(teamActivityTable).values({
    teamId,
    userId: profile.id,
    action: "message_sent",
    description: `${profile.name} sent a message`,
  });

  res.status(201).json({
    ...message,
    createdAt: message.createdAt.toISOString(),
    senderName: profile.name,
    senderUsername: profile.username,
    senderProfileImage: profile.profileImage,
  });
});

router.get("/teams/:id/activity", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const teamId = parseInt(String(req.params.id), 10);

  const { profile, member } = await getProfileAndTeamMembership(clerkId, teamId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  if (!member) { res.status(403).json({ error: "Not a team member" }); return; }

  const activity = await db
    .select({
      id: teamActivityTable.id,
      action: teamActivityTable.action,
      description: teamActivityTable.description,
      entityType: teamActivityTable.entityType,
      entityId: teamActivityTable.entityId,
      createdAt: teamActivityTable.createdAt,
      userName: profilesTable.name,
      userUsername: profilesTable.username,
    })
    .from(teamActivityTable)
    .innerJoin(profilesTable, eq(teamActivityTable.userId, profilesTable.id))
    .where(eq(teamActivityTable.teamId, teamId))
    .orderBy(desc(teamActivityTable.createdAt))
    .limit(50);

  res.json(activity.map((a: any) => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

router.post("/teams/:id/activity", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const teamId = parseInt(String(req.params.id), 10);

  const { profile, member } = await getProfileAndTeamMembership(clerkId, teamId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  if (!member) { res.status(403).json({ error: "Not a team member" }); return; }

  const { action, description, entityType, entityId } = req.body as {
    action: string; description: string; entityType?: string; entityId?: number;
  };

  const [log] = await db.insert(teamActivityTable).values({
    teamId, userId: profile.id, action, description, entityType, entityId,
  }).returning();

  res.status(201).json({ ...log, createdAt: log.createdAt.toISOString() });
});

export default router;
