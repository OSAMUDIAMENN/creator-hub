import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db, referralsTable, profilesTable, walletsTable, transactionsTable, notificationsTable, subscriptionsTable,
} from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import { nanoid } from "nanoid";

const router: IRouter = Router();

// Reward is 20% of first month's plan price (in NGN)
const REFERRAL_REWARD: Record<string, number> = {
  pro: 980,      // 20% of ₦4,900
  business: 1980, // 20% of ₦9,900
};

function generateCode(username: string): string {
  const slug = username.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  return `${slug}-${nanoid(5).toUpperCase()}`;
}

// ── Get or create my referral code + stats ───────────────────────────────────
router.get("/referral", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  // Find existing referral row owned by this user
  let [existing] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.referrerId, profile.id), eq(referralsTable.status, "pending")))
    .orderBy(desc(referralsTable.createdAt))
    .limit(1);

  // Create a dedicated code entry for this referrer if none exists
  let myCode: string;
  if (existing) {
    myCode = existing.code;
  } else {
    // Generate a fresh code row with no referee yet
    myCode = generateCode(profile.username);
    const [created] = await db.insert(referralsTable).values({
      referrerId: profile.id,
      refereeId: null,
      code: myCode,
      status: "pending",
      rewardAmount: "0",
    }).returning();
    existing = created;
  }

  // Count all conversions for this referrer
  const allReferrals = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, profile.id));

  const converted = allReferrals.filter((r: any) => r.status === "converted" || r.status === "rewarded");
  const rewarded = allReferrals.filter((r: any) => r.status === "rewarded");
  const totalEarned = rewarded.reduce((sum: number, r: any) => sum + Number(r.rewardAmount), 0);
  const pendingEarnings = converted.reduce((sum: number, r: any) => sum + Number(r.rewardAmount), 0);

  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.get("host") ?? "";
  const referralLink = `${proto}://${host}/sign-up?ref=${myCode}`;

  // Check if current user was referred by someone
  const [wasReferredRow] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.refereeId, profile.id)));

  // Fetch referee profiles for history enrichment
  const referralList = allReferrals.filter((r: any) => r.refereeId !== null);
  const refereeIds = referralList.map((r: any) => r.refereeId!);
  const refereeProfiles = refereeIds.length
    ? await db.select({ id: profilesTable.id, name: profilesTable.name, username: profilesTable.username })
        .from(profilesTable)
        .where(eq(profilesTable.id, refereeIds[0])) // handled in map below
        .then(() =>
          Promise.all(
            refereeIds.map((id: any) =>
              db.select({ id: profilesTable.id, name: profilesTable.name, username: profilesTable.username })
                .from(profilesTable)
                .where(eq(profilesTable.id, id))
                .then((rows: any) => rows[0])
            )
          )
        )
    : [];

  const refereeMap = new Map(refereeProfiles.filter(Boolean).map((p: any) => [p.id, p]));

  res.json({
    code: myCode,
    referralLink,
    totalReferrals: referralList.length,
    convertedReferrals: converted.length,
    totalEarned,
    pendingEarnings,
    wasReferred: !!wasReferredRow,
    referrals: referralList.map((r: any) => {
      const referee = refereeMap.get(r.refereeId!) as { id: number; name: string; username: string } | undefined;
      return {
        id: r.id,
        status: r.status,
        refereePlan: r.refereePlan,
        rewardAmount: Number(r.rewardAmount),
        createdAt: r.createdAt.toISOString(),
        convertedAt: r.convertedAt?.toISOString() ?? null,
        refereeName: referee?.name ?? null,
        refereeUsername: referee?.username ?? null,
      };
    }),
  });
});

// ── Apply a referral code at signup (called from frontend after Clerk signup) ─
router.post("/referral/apply", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { code } = req.body as { code?: string };
  if (!code) { res.status(400).json({ error: "code is required" }); return; }

  const [me] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!me) { res.status(404).json({ error: "Profile not found" }); return; }

  // Prevent existing creators (those who already have referral entries as a referrer) from applying codes
  const [alreadyReferrer] = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, me.id));
  if (alreadyReferrer) {
    res.status(400).json({ error: "Existing creators cannot apply referral codes. This feature is for new users only." });
    return;
  }

  // Check if this user has already been referred
  const [alreadyReferred] = await db.select().from(referralsTable).where(eq(referralsTable.refereeId, me.id));
  if (alreadyReferred) { res.status(400).json({ error: "You have already applied a referral code." }); return; }

  // Find the referral code (must be a pending row with no referee yet, or just by code)
  const [ref] = await db.select().from(referralsTable).where(eq(referralsTable.code, code));
  if (!ref) { res.status(404).json({ error: "Referral code not found" }); return; }
  if (ref.referrerId === me.id) { res.status(400).json({ error: "Cannot use your own referral code" }); return; }
  if (ref.refereeId) { res.status(400).json({ error: "This code has already been used" }); return; }

  // Link this user as the referee
  await db.update(referralsTable).set({ refereeId: me.id }).where(eq(referralsTable.id, ref.id));

  // Immediately create a fresh pending code for the referrer so they can still share
  const [referrer] = await db.select().from(profilesTable).where(eq(profilesTable.id, ref.referrerId));
  if (referrer) {
    await db.insert(referralsTable).values({
      referrerId: referrer.id,
      refereeId: null,
      code: generateCode(referrer.username),
      status: "pending",
      rewardAmount: "0",
    });
  }

  res.json({ success: true, referrerUsername: referrer?.username ?? null });
});

// ── Internal: called by paystack.ts after a paid subscription activates ───────
// Export so paystack.ts can call it directly
export async function rewardReferrerIfApplicable(refereeUserId: number, plan: string): Promise<void> {
  const reward = REFERRAL_REWARD[plan];
  if (!reward) return;

  // Find the referral where this user is the referee and it's still pending
  const [ref] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.refereeId, refereeUserId), eq(referralsTable.status, "pending")));

  if (!ref) return;

  // Mark as rewarded
  await db.update(referralsTable).set({
    status: "rewarded",
    rewardAmount: String(reward),
    refereePlan: plan,
    convertedAt: new Date(),
  }).where(eq(referralsTable.id, ref.id));

  // Credit the referrer's wallet
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, ref.referrerId));
  if (wallet) {
    await db.update(walletsTable).set({
      balance: String(Number(wallet.balance) + reward),
      totalEarned: String(Number(wallet.totalEarned) + reward),
    }).where(eq(walletsTable.id, wallet.id));
  } else {
    await db.insert(walletsTable).values({
      userId: ref.referrerId,
      balance: String(reward),
      totalEarned: String(reward),
      totalWithdrawn: "0.00",
      currency: "NGN",
    });
  }

  // Log transaction
  await db.insert(transactionsTable).values({
    userId: ref.referrerId,
    type: "earning",
    amount: String(reward),
    currency: "NGN",
    description: `Referral reward: your invite upgraded to ${plan}`,
    reference: `REF-${ref.id}-${Date.now()}`,
    status: "completed",
    metadata: JSON.stringify({ referralId: ref.id, refereeUserId, plan }),
  });

  // Notify the referrer
  await db.insert(notificationsTable).values({
    userId: ref.referrerId,
    type: "reward",
    title: "🎉 Referral reward earned!",
    message: `Someone you referred just upgraded to ${plan === "pro" ? "Creator Pro" : "Creator Business"}. You earned ₦${reward.toLocaleString("en-NG")}!`,
    data: JSON.stringify({ referralId: ref.id, reward, plan }),
  });
}

export default router;
