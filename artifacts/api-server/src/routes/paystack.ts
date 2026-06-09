import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { rewardReferrerIfApplicable } from "./referrals";
import { db, profilesTable, subscriptionsTable, transactionsTable, walletsTable, productsTable, notificationsTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} from "../lib/paystack";
import { sendCreatorSaleNotification, sendBuyerConfirmation } from "../lib/email.js";

const router: IRouter = Router();

const PLAN_PRICES: Record<string, number> = {
  pro: 500000,
  business: 1500000,
};

const PLAN_NAMES: Record<string, string> = {
  pro: "Creator Pro",
  business: "Creator Business",
};

const PLATFORM_FEE_PERCENT = 5;

const CREDIT_PACKS: Record<string, { credits: number; priceKobo: number }> = {
  credits_50: { credits: 50, priceKobo: 50000 },
  credits_150: { credits: 150, priceKobo: 120000 },
  credits_400: { credits: 400, priceKobo: 250000 },
  credits_1000: { credits: 1000, priceKobo: 500000 },
};

function generateReference(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function getCallbackUrl(req: Request, path: string) {
  const host = req.get("host") ?? "";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}/api/paystack/${path}`;
}

// ─── Subscription checkout ────────────────────────────────────────────────────

router.post("/paystack/initialize", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { plan } = req.body as { plan: string };
  if (!plan || !PLAN_PRICES[plan]) {
    res.status(400).json({ error: "Invalid plan. Must be 'pro' or 'business'" }); return;
  }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const email = profile.email ?? `${clerkId}@creatorhub.app`;
  const reference = generateReference(`SUB-${plan.toUpperCase()}`);
  const amountKobo = PLAN_PRICES[plan];

  const tx = await initializeTransaction({
    email,
    amountKobo,
    reference,
    callbackUrl: getCallbackUrl(req, "callback"),
    metadata: {
      clerkId,
      userId: profile.id,
      plan,
      type: "subscription",
    },
  });

  await db.insert(transactionsTable).values({
    userId: profile.id,
    type: "subscription",
    amount: String(amountKobo / 100),
    currency: "NGN",
    description: `${PLAN_NAMES[plan]} subscription payment`,
    reference,
    status: "pending",
    metadata: JSON.stringify({ plan }),
  });

  res.json({ authorizationUrl: tx.authorization_url, reference });
});

router.get("/paystack/callback", async (req: Request, res: Response): Promise<void> => {
  const reference = req.query.reference as string;
  if (!reference) { res.redirect("/?payment=failed"); return; }

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status !== "success") { res.redirect("/?payment=failed"); return; }

    const meta = tx.metadata as { userId?: number; plan?: string; clerkId?: string; customerCode?: string };
    if (!meta?.userId || !meta?.plan) { res.redirect("/?payment=failed"); return; }

    await activateSubscription({
      userId: meta.userId,
      plan: meta.plan,
      reference,
      paystackCustomerCode: meta.customerCode ?? tx.customer?.customer_code,
    });
    res.redirect("/dashboard/pricing?payment=success");
  } catch (err) {
    req.log.error({ err }, "Paystack callback error");
    res.redirect("/dashboard/pricing?payment=failed");
  }
});

// ─── Credit checkout ──────────────────────────────────────────────────────────

router.post("/paystack/credits/checkout", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { packId } = req.body as { packId?: string };
  const pack = packId ? CREDIT_PACKS[packId] : undefined;
  if (!pack) { res.status(400).json({ error: "Invalid pack ID" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const reference = generateReference("CREDITS");
  const email = profile.email ?? `user-${profile.id}@creatorhub.app`;

  const tx = await initializeTransaction({
    email,
    amountKobo: pack.priceKobo,
    reference,
    callbackUrl: getCallbackUrl(req, "credits-callback"),
    metadata: {
      type: "credit_purchase",
      userId: profile.id,
      credits: pack.credits,
      packId,
    },
  });

  res.json({ authorizationUrl: tx.authorization_url, reference });
});

router.get("/paystack/credits-callback", async (req: Request, res: Response): Promise<void> => {
  const reference = req.query.reference as string;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.get("host") ?? "";
  const frontendBase = `${proto}://${host}/dashboard/credits`;

  if (!reference) { res.redirect(`${frontendBase}?payment=failed`); return; }

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status !== "success") { res.redirect(`${frontendBase}?payment=failed`); return; }

    const meta = tx.metadata as { userId?: number; credits?: number };
    if (meta?.userId && meta?.credits) {
      await fulfillCreditPurchase(meta.userId, meta.credits, tx.amount, reference);
    }
    res.redirect(`${frontendBase}?payment=success`);
  } catch (err) {
    req.log.error({ err }, "Credits callback error");
    res.redirect(`${frontendBase}?payment=failed`);
  }
});

// ─── Product checkout ─────────────────────────────────────────────────────────

router.post("/paystack/product/:id/checkout", async (req: Request, res: Response): Promise<void> => {
  const productId = parseInt(req.params.id as string, 10);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product ID" }); return; }

  const { email, buyerName } = req.body as { email?: string; buyerName?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email is required" }); return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product || !product.isActive) { res.status(404).json({ error: "Product not found" }); return; }

  const [creator] = await db.select().from(profilesTable).where(eq(profilesTable.id, product.userId));
  if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }

  if (Number(product.price) === 0) {
    await db.update(productsTable)
      .set({ salesCount: sql`${productsTable.salesCount} + 1` })
      .where(eq(productsTable.id, productId));
    res.json({ free: true, fileUrl: product.fileUrl, productName: product.name });
    return;
  }

  const amountKobo = Math.round(Number(product.price) * 100);
  const reference = generateReference(`PROD-${productId}`);
  const resolvedBuyerName = buyerName?.trim() || "Customer";

  const tx = await initializeTransaction({
    email,
    amountKobo,
    reference,
    callbackUrl: getCallbackUrl(req, "product-callback"),
    metadata: {
      type: "product_purchase",
      productId,
      creatorUserId: creator.id,
      buyerEmail: email,
      buyerName: resolvedBuyerName,
    },
  });

  res.json({ authorizationUrl: tx.authorization_url, reference });
});

router.get("/paystack/product-callback", async (req: Request, res: Response): Promise<void> => {
  const reference = req.query.reference as string;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.get("host") ?? "";
  const baseFrontendUrl = `${proto}://${host}`;

  if (!reference) { res.redirect(`${baseFrontendUrl}/product/download?error=no_reference`); return; }

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status !== "success") {
      res.redirect(`${baseFrontendUrl}/product/download?error=payment_failed`); return;
    }

    const meta = tx.metadata as { productId?: number; creatorUserId?: number; buyerEmail?: string; buyerName?: string };
    if (meta?.productId && meta?.creatorUserId) {
      await fulfillProductPurchase(meta.productId, meta.creatorUserId, tx.amount, reference, meta.buyerEmail, meta.buyerName);
    }

    res.redirect(`${baseFrontendUrl}/product/download?ref=${encodeURIComponent(reference)}`);
  } catch (err) {
    req.log.error({ err }, "Product callback error");
    res.redirect(`${baseFrontendUrl}/product/download?error=verification_failed`);
  }
});

router.get("/paystack/product-download-info", async (req: Request, res: Response): Promise<void> => {
  const reference = req.query.reference as string;
  if (!reference) { res.status(400).json({ error: "Reference required" }); return; }

  const [tx] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.reference, reference));

  if (!tx || tx.status !== "completed") {
    res.status(404).json({ error: "Payment not found or not completed" }); return;
  }

  const meta = tx.metadata ? JSON.parse(tx.metadata) : {};
  if (!meta.productId) { res.status(404).json({ error: "Product info not found" }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, meta.productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [creator] = await db.select().from(profilesTable).where(eq(profilesTable.id, product.userId));

  res.json({
    productName: product.name,
    fileUrl: product.fileUrl,
    creatorName: creator?.name ?? creator?.username ?? "Creator",
  });
});

// ─── Manual verify (frontend polling fallback) ────────────────────────────────

router.post("/paystack/verify", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { reference } = req.body as { reference: string };
  if (!reference) { res.status(400).json({ error: "Reference required" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status === "success") {
      const meta = tx.metadata as { userId?: number; plan?: string };
      if (meta?.plan && meta?.userId === profile.id) {
        await activateSubscription({
          userId: profile.id,
          plan: meta.plan,
          reference,
          paystackCustomerCode: tx.customer?.customer_code,
        });
        res.json({ success: true, plan: meta.plan });
        return;
      }
    }
    res.json({ success: false, status: tx.status });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Webhook (Paystack → server) ──────────────────────────────────────────────

router.post("/paystack/webhook", async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers["x-paystack-signature"] as string | undefined;
  const rawBody = (req as any).rawBody as string | undefined;

  res.json({ received: true });

  if (!rawBody || !signature) {
    req.log.warn("Paystack webhook: missing raw body or signature — skipping");
    return;
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    req.log.warn("Paystack webhook: invalid HMAC signature — discarding");
    return;
  }

  const event = req.body as { event: string; data: any };
  req.log.info({ event: event.event }, "Paystack webhook received");

  try {
    switch (event.event) {

      case "charge.success": {
        const data = event.data;
        const meta = data?.metadata as {
          type?: string;
          userId?: number;
          plan?: string;
          credits?: number;
          productId?: number;
          creatorUserId?: number;
          buyerEmail?: string;
          buyerName?: string;
        } | undefined;

        if (meta?.type === "subscription" && meta.userId && meta.plan) {
          await activateSubscription({
            userId: meta.userId,
            plan: meta.plan,
            reference: data.reference,
            paystackCustomerCode: data.customer?.customer_code,
          });
        }

        if (meta?.type === "product_purchase" && meta.productId && meta.creatorUserId) {
          await fulfillProductPurchase(meta.productId, meta.creatorUserId, data.amount, data.reference, meta.buyerEmail, meta.buyerName);
        }

        if (meta?.type === "credit_purchase" && meta.userId && meta.credits) {
          await fulfillCreditPurchase(meta.userId, meta.credits, data.amount, data.reference);
        }
        break;
      }

      case "subscription.create": {
        const data = event.data;
        const customerCode = data?.customer?.customer_code as string | undefined;
        const subscriptionCode = data?.subscription_code as string | undefined;
        const planCode = data?.plan?.plan_code as string | undefined;

        if (!customerCode || !subscriptionCode) break;

        const plan = planCode
          ? (Object.entries(PLAN_PRICES).find(([k]) => planCode.toLowerCase().includes(k))?.[0] ?? null)
          : null;

        const [sub] = await db
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.paystackCustomerCode, customerCode));

        if (sub) {
          await db
            .update(subscriptionsTable)
            .set({
              paystackSubscriptionCode: subscriptionCode,
              ...(plan ? { plan } : {}),
            })
            .where(eq(subscriptionsTable.id, sub.id));
        }
        break;
      }

      case "invoice.update": {
        const data = event.data;
        if (data?.status !== "success") break;

        const customerCode = data?.customer?.customer_code as string | undefined;
        const subscriptionCode = data?.subscription?.subscription_code as string | undefined;
        const reference = data?.transaction?.reference as string | undefined;

        if (!customerCode || !reference) break;

        const [sub] = await db
          .select({ id: subscriptionsTable.id, userId: subscriptionsTable.userId, plan: subscriptionsTable.plan })
          .from(subscriptionsTable)
          .where(
            subscriptionCode
              ? eq(subscriptionsTable.paystackSubscriptionCode, subscriptionCode)
              : eq(subscriptionsTable.paystackCustomerCode, customerCode)
          );

        if (!sub) {
          req.log.warn({ customerCode, subscriptionCode }, "invoice.update: no subscription found");
          break;
        }

        const [existing] = await db
          .select({ id: transactionsTable.id, status: transactionsTable.status })
          .from(transactionsTable)
          .where(eq(transactionsTable.reference, reference));

        if (existing?.status === "completed") {
          req.log.info({ reference }, "invoice.update: already processed, skipping");
          break;
        }

        const [currentSub] = await db
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.id, sub.id));

        const periodStart = new Date();
        const periodEnd = new Date(currentSub?.currentPeriodEnd ?? periodStart);
        if (periodEnd <= periodStart) {
          periodEnd.setTime(periodStart.getTime());
        }
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await db
          .update(subscriptionsTable)
          .set({
            status: "active",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          })
          .where(eq(subscriptionsTable.id, sub.id));

        const amountNgn = (data?.amount ?? 0) / 100;
        if (existing) {
          await db
            .update(transactionsTable)
            .set({ status: "completed" })
            .where(eq(transactionsTable.reference, reference));
        } else {
          await db.insert(transactionsTable).values({
            userId: sub.userId,
            type: "subscription",
            amount: String(amountNgn),
            currency: "NGN",
            description: `${PLAN_NAMES[sub.plan] ?? sub.plan} renewal`,
            reference,
            status: "completed",
            metadata: JSON.stringify({ plan: sub.plan, renewal: true }),
          });
        }

        req.log.info({ userId: sub.userId, plan: sub.plan, periodEnd }, "Subscription renewed");
        break;
      }

      case "invoice.payment_failed": {
        const data = event.data;
        const customerCode = data?.customer?.customer_code as string | undefined;
        const subscriptionCode = data?.subscription?.subscription_code as string | undefined;

        if (!customerCode) break;

        const [sub] = await db
          .select({ id: subscriptionsTable.id })
          .from(subscriptionsTable)
          .where(
            subscriptionCode
              ? eq(subscriptionsTable.paystackSubscriptionCode, subscriptionCode)
              : eq(subscriptionsTable.paystackCustomerCode, customerCode)
          );

        if (sub) {
          await db
            .update(subscriptionsTable)
            .set({ status: "past_due" })
            .where(eq(subscriptionsTable.id, sub.id));
          req.log.warn({ subId: sub.id }, "Subscription payment failed — marked past_due");
        }
        break;
      }

      case "subscription.disable":
      case "subscription.not_renew": {
        const data = event.data;
        const customerCode = data?.customer?.customer_code as string | undefined;
        const subscriptionCode = data?.subscription_code as string | undefined;

        if (!customerCode && !subscriptionCode) break;

        const [sub] = await db
          .select({ id: subscriptionsTable.id })
          .from(subscriptionsTable)
          .where(
            subscriptionCode
              ? eq(subscriptionsTable.paystackSubscriptionCode, subscriptionCode)
              : eq(subscriptionsTable.paystackCustomerCode, customerCode!)
          );

        if (sub) {
          await db
            .update(subscriptionsTable)
            .set({ cancelAtPeriodEnd: true })
            .where(eq(subscriptionsTable.id, sub.id));
          req.log.info({ subId: sub.id }, "Subscription set to cancel at period end");
        }
        break;
      }

      default:
        req.log.info({ event: event.event }, "Unhandled Paystack event — ignoring");
    }
  } catch (err) {
    req.log.error({ err, event: event.event }, "Webhook processing error");
  }
});

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function activateSubscription({
  userId,
  plan,
  reference,
  paystackCustomerCode,
  paystackSubscriptionCode,
}: {
  userId: number;
  plan: string;
  reference: string;
  paystackCustomerCode?: string;
  paystackSubscriptionCode?: string;
}) {
  const [existingTx] = await db
    .select({ id: transactionsTable.id, status: transactionsTable.status })
    .from(transactionsTable)
    .where(eq(transactionsTable.reference, reference));

  if (existingTx?.status === "completed") return;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [existing] = await db
    .select({ id: subscriptionsTable.id })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  const subscriptionFields = {
    plan,
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    ...(paystackCustomerCode ? { paystackCustomerCode } : {}),
    ...(paystackSubscriptionCode ? { paystackSubscriptionCode } : {}),
  };

  if (existing) {
    await db
      .update(subscriptionsTable)
      .set(subscriptionFields)
      .where(eq(subscriptionsTable.id, existing.id));
  } else {
    await db.insert(subscriptionsTable).values({
      userId,
      ...subscriptionFields,
    });
  }

  if (existingTx) {
    await db
      .update(transactionsTable)
      .set({ status: "completed" })
      .where(eq(transactionsTable.reference, reference));
  } else {
    await db.insert(transactionsTable).values({
      userId,
      type: "subscription",
      amount: String(PLAN_PRICES[plan] / 100),
      currency: "NGN",
      description: `${PLAN_NAMES[plan] ?? plan} subscription activated`,
      reference,
      status: "completed",
      metadata: JSON.stringify({ plan }),
    });
  }

  // Fire referral reward (async, non-blocking — don't let it fail the subscription)
  rewardReferrerIfApplicable(userId, plan).catch(() => {});
}

async function fulfillCreditPurchase(
  userId: number,
  credits: number,
  amountKobo: number,
  reference: string,
) {
  const { aiUsageTable } = await import("@workspace/db");
  const { getCurrentPeriodMonth } = await import("./ai_credits");

  const [existing] = await db
    .select({ id: transactionsTable.id, status: transactionsTable.status })
    .from(transactionsTable)
    .where(eq(transactionsTable.reference, reference));

  if (existing?.status === "completed") return;

  const periodMonth = getCurrentPeriodMonth();
  await db.insert(aiUsageTable).values({
    userId,
    tool: "purchase",
    creditsUsed: -credits,
    periodMonth,
  });

  const amountNgn = amountKobo / 100;
  if (existing) {
    await db
      .update(transactionsTable)
      .set({ status: "completed" })
      .where(eq(transactionsTable.reference, reference));
  } else {
    await db.insert(transactionsTable).values({
      userId,
      type: "credit_purchase",
      amount: String(amountNgn),
      currency: "NGN",
      description: `AI Credits purchase (+${credits} credits)`,
      reference,
      status: "completed",
    });
  }
}

async function fulfillProductPurchase(
  productId: number,
  creatorUserId: number,
  amountKobo: number,
  reference: string,
  buyerEmail?: string,
  buyerName?: string,
) {
  const [existing] = await db
    .select({ id: transactionsTable.id, status: transactionsTable.status })
    .from(transactionsTable)
    .where(eq(transactionsTable.reference, reference));

  if (existing?.status === "completed") return;

  const amountNgn = amountKobo / 100;
  const creatorEarnings = amountNgn * (1 - PLATFORM_FEE_PERCENT / 100);

  await db
    .update(productsTable)
    .set({ salesCount: sql`${productsTable.salesCount} + 1` })
    .where(eq(productsTable.id, productId));

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, creatorUserId));
  if (wallet) {
    await db
      .update(walletsTable)
      .set({
        balance: String(Number(wallet.balance) + creatorEarnings),
        totalEarned: String(Number(wallet.totalEarned) + creatorEarnings),
      })
      .where(eq(walletsTable.id, wallet.id));
  } else {
    await db.insert(walletsTable).values({
      userId: creatorUserId,
      balance: String(creatorEarnings),
      totalEarned: String(creatorEarnings),
      totalWithdrawn: "0.00",
      currency: "NGN",
    });
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));

  if (existing) {
    await db
      .update(transactionsTable)
      .set({ status: "completed", metadata: JSON.stringify({ productId, buyerEmail, buyerName }) })
      .where(eq(transactionsTable.reference, reference));
  } else {
    await db.insert(transactionsTable).values({
      userId: creatorUserId,
      type: "earning",
      amount: String(creatorEarnings),
      currency: "NGN",
      description: `Sale: ${product?.name ?? "Product"} (after ${PLATFORM_FEE_PERCENT}% platform fee)`,
      reference,
      status: "completed",
      metadata: JSON.stringify({ productId, buyerEmail, buyerName }),
    });
  }

  // Notify the creator about the new sale with buyer details
  const buyerDisplay = buyerName ? `${buyerName}` : "Someone";
  const emailDisplay = buyerEmail ? ` (${buyerEmail})` : "";
  await db.insert(notificationsTable).values({
    userId: creatorUserId,
    type: "sale",
    title: "🎉 New sale!",
    message: `${buyerDisplay}${emailDisplay} just bought "${product?.name ?? "your product"}" for ₦${amountNgn.toLocaleString("en-NG")}. You earned ₦${creatorEarnings.toLocaleString("en-NG", { maximumFractionDigits: 2 })}.`,
    data: JSON.stringify({ productId, buyerEmail, buyerName, amount: creatorEarnings, reference }),
  });

  // Send email notifications (graceful — skips if RESEND_API_KEY not set)
  const [creator] = await db
    .select({ email: profilesTable.email, name: profilesTable.name })
    .from(profilesTable)
    .where(eq(profilesTable.id, creatorUserId));

  if (creator?.email) {
    await sendCreatorSaleNotification({
      creatorEmail: creator.email,
      creatorName: creator.name ?? "Creator",
      productName: product?.name ?? "Product",
      buyerName: buyerDisplay,
      buyerEmail,
      amountNgn,
      creatorEarnings,
      reference,
    });
  }

  if (buyerEmail) {
    await sendBuyerConfirmation({
      buyerEmail,
      buyerName: buyerName ?? "Customer",
      productName: product?.name ?? "Product",
      creatorName: creator?.name ?? "Creator",
      fileUrl: (product as any)?.fileUrl ?? null,
      amountNgn,
      reference,
    });
  }
}

export default router;
