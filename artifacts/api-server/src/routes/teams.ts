import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, profilesTable, teamsTable, teamMembersTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import crypto from "node:crypto";

const router: IRouter = Router();

router.get("/teams", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const memberships = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, profile.id));

  const teamIds = memberships.map((m: any) => m.teamId);
  if (teamIds.length === 0) { res.json([]); return; }

  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, teamIds[0]));

  // For each team, get member count
  const result = await Promise.all(
    teams.map(async (team: any) => {
      const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, team.id));
      const myMembership = memberships.find((m: any) => m.teamId === team.id);
      return {
        id: team.id,
        name: team.name,
        slug: team.slug,
        plan: team.plan,
        inviteCode: team.inviteCode ?? null,
        role: myMembership?.role ?? "viewer",
        memberCount: members.length,
        createdAt: team.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/teams", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { name, slug } = req.body as { name: string; slug: string };
  if (!name || !slug) { res.status(400).json({ error: "Name and slug required" }); return; }

  const inviteCode = crypto.randomBytes(6).toString("hex");
  const [team] = await db
    .insert(teamsTable)
    .values({ ownerId: profile.id, name, slug, plan: "business", inviteCode })
    .returning();

  // Add owner as member
  await db.insert(teamMembersTable).values({ teamId: team.id, userId: profile.id, role: "owner" });

  res.status(201).json({
    id: team.id,
    name: team.name,
    slug: team.slug,
    plan: team.plan,
    inviteCode: team.inviteCode,
    role: "owner",
    memberCount: 1,
    createdAt: team.createdAt.toISOString(),
  });
});

router.get("/teams/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const teamId = parseInt(String(req.params.id), 10);
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const members = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.teamId, teamId));

  const membersWithProfiles = await Promise.all(
    members.map(async (m: any) => {
      const [p] = await db.select().from(profilesTable).where(eq(profilesTable.id, m.userId));
      return {
        id: m.id,
        userId: m.userId,
        name: p?.name ?? "Unknown",
        email: p?.email ?? "",
        role: m.role,
        joinedAt: m.joinedAt?.toISOString() ?? null,
      };
    })
  );

  res.json({
    id: team.id,
    name: team.name,
    slug: team.slug,
    plan: team.plan,
    inviteCode: team.inviteCode ?? null,
    members: membersWithProfiles,
    createdAt: team.createdAt.toISOString(),
  });
});

router.post("/teams/:id/members", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const teamId = parseInt(String(req.params.id), 10);
  const { email, role } = req.body as { email: string; role: string };

  if (!email || !role) { res.status(400).json({ error: "Email and role required" }); return; }

  // Find user by email
  const [invitedProfile] = await db.select().from(profilesTable).where(eq(profilesTable.email, email));

  if (invitedProfile) {
    await db.insert(teamMembersTable).values({
      teamId,
      userId: invitedProfile.id,
      role,
      invitedEmail: email,
    });
  } else {
    // Store pending invite (user not registered yet)
    await db.insert(teamMembersTable).values({
      teamId,
      userId: profile.id, // placeholder, would be updated on join
      role,
      invitedEmail: email,
    });
  }

  res.status(201).json({ success: true });
});

router.delete("/teams/:id/members/:memberId", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const memberId = parseInt(String(req.params.memberId), 10);
  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, memberId));
  res.status(204).send();
});

export default router;
