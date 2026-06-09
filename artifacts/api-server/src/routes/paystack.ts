import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { rewardReferrerIfApplicable } from "./referrals";
import {
  db, profilesTable, subscriptionsTable, transactionsTable, walletsTable, productsTable,
  notificationsTable, platformSettingsTable, tipsTable, productPurchasesTable,
  marketplaceOrdersTable, marketplaceListingsTable, creatorFanSubscriptionsTable, creatorSubscriptionTiersTable,
} from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} from "../lib/paystack";
import {
  sendCreatorSaleNotification, sendBuyerConfirmation, sendTipReceivedNotification,
  sendMarketplaceOrderNotification, sendRefundConfirmation,
} from "../lib/email.js";
import { PLAN_PRICES_KOBO, PLAN_NAMES } from "../lib/plan-config";

const router: IRouter = Router();

const PLAN_PRICES = PLAN_PRICES_KOBO;

const DEFAULT_PLATFORM_FEE_PERCENT = 5;

async function getPlatformFeePercent(): Promise<number> {
  try {
    const [setting] = await db
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "platform_fee_percent"));
    if (setting) {
      const val = parseFloat(setting.value);
      if (!isNaN(val) && val >= 0 && val <= 50) return val;
    }
  } catch {}
  return DEFAULT_PLATFORM_FEE_PERCENT;
}

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
  const buyerEmail = (req.query.email as string | undefined)?.toLowerCase().trim();

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

  // Verify buyer email matches purchase record when provided
  if (buyerEmail && meta.buyerEmail && meta.buyerEmail.toLowerCase() !== buyerEmail) {
    res.status(403).json({ error: "Email does not match purchase record" }); return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, meta.productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [creator] = await db.select().from(profilesTable).where(eq(profilesTable.id, product.userId));

  // Enforce download limits
  const [purchase] = await db
    .select()
    .from(productPurchasesTable)
    .where(eq(productPurchasesTable.reference, reference));

  if (purchase?.maxDownloads != null && (purchase.downloadCount ?? 0) >= purchase.maxDownloads) {
    res.status(403).json({
      error: "Download limit reached",
      downloadCount: purchase.downloadCount,
      maxDownloads: purchase.maxDownloads,
    }); return;
  }

  // Increment download count
  if (purchase) {
    await db
      .update(productPurchasesTable)
      .set({
        downloadCount: sql`${productPurchasesTable.downloadCount} + 1`,
        lastDownloadAt: new Date(),
      })
      .where(eq(productPurchasesTable.id, purchase.id));
  }

  res.json({
    productName: product.name,
    fileUrl: product.fileUrl,
    creatorName: creator?.name ?? creator?.username ?? "Creator",
    downloadCount: (purchase?.downloadCount ?? 0) + 1,
    maxDownloads: purchase?.maxDownloads ?? null,
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
          creatorId?: number;
          tipperName?: string;
          tipperEmail?: string;
          isAnonymous?: boolean;
          message?: string | null;
          listingId?: number;
          sellerId?: number;
          requirements?: string | null;
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

        if (meta?.type === "tip" && meta.creatorId) {
          await fulfillTip(meta.creatorId, data.amount, data.reference, {
            tipperName: meta.tipperName,
            tipperEmail: meta.tipperEmail,
            isAnonymous: meta.isAnonymous ?? false,
            message: meta.message,
          });
        }

        if (meta?.type === "marketplace_order" && meta.listingId && meta.sellerId) {
          await fulfillMarketplaceOrder(meta.listingId, meta.sellerId, data.amount, data.reference, {
            buyerEmail: meta.buyerEmail ?? "",
            buyerName: meta.buyerName,
            message: meta.message,
            requirements: meta.requirements,
          });
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
  const feePercent = await getPlatformFeePercent();
  const creatorEarnings = amountNgn * (1 - feePercent / 100);

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
      description: `Sale: ${product?.name ?? "Product"} (after ${feePercent}% platform fee)`,
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

  // Create product_purchases record for download tracking
  const [purchaseExists] = await db
    .select({ id: productPurchasesTable.id })
    .from(productPurchasesTable)
    .where(eq(productPurchasesTable.reference, reference));
  if (!purchaseExists) {
    await db.insert(productPurchasesTable).values({
      productId,
      buyerEmail: buyerEmail ?? "unknown@buyer.com",
      buyerName: buyerName ?? null,
      amount: String(amountNgn),
      currency: "NGN",
      reference,
      status: "completed",
      downloadCount: 0,
      maxDownloads: (product as any)?.downloadLimit ?? null,
    });
  }

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

// ─── Tip checkout ─────────────────────────────────────────────────────────────

router.post("/paystack/tip/:username/checkout", async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params as { username: string };
  const { email, name, amount, message, isAnonymous } = req.body as {
    email?: string; name?: string; amount?: number; message?: string; isAnonymous?: boolean;
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email is required" }); return;
  }
  if (!amount || amount < 100) {
    res.status(400).json({ error: "Minimum tip amount is ₦100" }); return;
  }

  const [creator] = await db.select().from(profilesTable).where(eq(profilesTable.username, username));
  if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }

  const reference = generateReference(`TIP-${creator.id}`);
  const amountKobo = Math.round(amount * 100);
  const tipperName = isAnonymous ? "Anonymous" : (name?.trim() || "Anonymous");

  await db.insert(tipsTable).values({
    creatorId: creator.id,
    tipperName: isAnonymous ? null : tipperName,
    tipperEmail: isAnonymous ? null : email,
    isAnonymous: !!isAnonymous,
    message: message?.trim() ?? null,
    amount: String(amount),
    currency: "NGN",
    reference,
    status: "pending",
  });

  const tx = await initializeTransaction({
    email,
    amountKobo,
    reference,
    callbackUrl: getCallbackUrl(req, "tip-callback"),
    metadata: {
      type: "tip",
      creatorId: creator.id,
      creatorUsername: username,
      tipperName,
      tipperEmail: email,
      isAnonymous: !!isAnonymous,
      message: message?.trim() ?? null,
    },
  });

  res.json({ authorizationUrl: tx.authorization_url, reference });
});

router.get("/paystack/tip-callback", async (req: Request, res: Response): Promise<void> => {
  const reference = req.query.reference as string;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.get("host") ?? "";
  const baseFrontendUrl = `${proto}://${host}`;

  if (!reference) { res.redirect(`${baseFrontendUrl}/?tip=failed`); return; }

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status !== "success") {
      res.redirect(`${baseFrontendUrl}/?tip=failed`); return;
    }

    const meta = tx.metadata as {
      type?: string; creatorId?: number; tipperName?: string;
      tipperEmail?: string; isAnonymous?: boolean; message?: string;
    };

    if (meta?.type === "tip" && meta.creatorId) {
      await fulfillTip(meta.creatorId, tx.amount, reference, {
        tipperName: meta.tipperName,
        tipperEmail: meta.tipperEmail,
        isAnonymous: meta.isAnonymous ?? false,
        message: meta.message,
      });
    }

    res.redirect(`${baseFrontendUrl}/?tip=success`);
  } catch (err) {
    req.log.error({ err }, "Tip callback error");
    res.redirect(`${baseFrontendUrl}/?tip=failed`);
  }
});

// ─── Marketplace order checkout ───────────────────────────────────────────────

router.post("/paystack/marketplace/:listingId/checkout", async (req: Request, res: Response): Promise<void> => {
  const listingId = parseInt(req.params.listingId as string, 10);
  if (isNaN(listingId)) { res.status(400).json({ error: "Invalid listing ID" }); return; }

  const { email, buyerName, message, requirements } = req.body as {
    email?: string; buyerName?: string; message?: string; requirements?: string;
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email is required" }); return;
  }

  const [listing] = await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.id, listingId));
  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }

  const [seller] = await db.select().from(profilesTable).where(eq(profilesTable.id, listing.sellerId));
  if (!seller) { res.status(404).json({ error: "Seller not found" }); return; }

  const amountKobo = Math.round(Number(listing.price) * 100);
  const reference = generateReference(`MKT-${listingId}`);

  const tx = await initializeTransaction({
    email,
    amountKobo,
    reference,
    callbackUrl: getCallbackUrl(req, "marketplace-callback"),
    metadata: {
      type: "marketplace_order",
      listingId,
      sellerId: seller.id,
      buyerEmail: email,
      buyerName: buyerName?.trim() || "Customer",
      message: message?.trim() ?? null,
      requirements: requirements?.trim() ?? null,
    },
  });

  res.json({ authorizationUrl: tx.authorization_url, reference });
});

router.get("/paystack/marketplace-callback", async (req: Request, res: Response): Promise<void> => {
  const reference = req.query.reference as string;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.get("host") ?? "";
  const baseFrontendUrl = `${proto}://${host}`;

  if (!reference) { res.redirect(`${baseFrontendUrl}/dashboard/store?order=failed`); return; }

  try {
    const tx = await verifyTransaction(reference);
    if (tx.status !== "success") {
      res.redirect(`${baseFrontendUrl}/?order=failed`); return;
    }

    const meta = tx.metadata as {
      type?: string; listingId?: number; sellerId?: number;
      buyerEmail?: string; buyerName?: string; message?: string; requirements?: string;
    };

    if (meta?.type === "marketplace_order" && meta.listingId && meta.sellerId) {
      await fulfillMarketplaceOrder(meta.listingId, meta.sellerId, tx.amount, reference, {
        buyerEmail: meta.buyerEmail ?? "",
        buyerName: meta.buyerName,
        message: meta.message,
        requirements: meta.requirements,
      });
    }

    res.redirect(`${baseFrontendUrl}/?order=success`);
  } catch (err) {
    req.log.error({ err }, "Marketplace callback error");
    res.redirect(`${baseFrontendUrl}/?order=failed`);
  }
});

// ─── Admin: platform fee & product refunds ────────────────────────────────────

router.get("/admin/settings/platform-fee", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const fee = await getPlatformFeePercent();
  res.json({ platformFeePercent: fee });
});

router.patch("/admin/settings/platform-fee", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const { platformFeePercent } = req.body as { platformFeePercent?: number };
  if (typeof platformFeePercent !== "number" || platformFeePercent < 0 || platformFeePercent > 50) {
    res.status(400).json({ error: "Fee must be between 0 and 50 percent" }); return;
  }

  const [existing] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, "platform_fee_percent"));

  if (existing) {
    await db.update(platformSettingsTable).set({ value: String(platformFeePercent) }).where(eq(platformSettingsTable.key, "platform_fee_percent"));
  } else {
    await db.insert(platformSettingsTable).values({ key: "platform_fee_percent", value: String(platformFeePercent) });
  }

  res.json({ platformFeePercent, message: "Platform fee updated successfully" });
});

router.post("/admin/products/:purchaseRef/refund", requireAuth(), async (req: Request, res: Response): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const { purchaseRef } = req.params as { purchaseRef: string };

  const [purchase] = await db
    .select()
    .from(productPurchasesTable)
    .where(eq(productPurchasesTable.reference, purchaseRef));

  if (!purchase) { res.status(404).json({ error: "Purchase not found" }); return; }
  if (purchase.status === "refunded") { res.status(400).json({ error: "Already refunded" }); return; }

  const [tx] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.reference, purchaseRef));

  if (tx) {
    const creatorEarnings = Number(tx.amount);
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, tx.userId));
    if (wallet) {
      const deduct = Math.min(creatorEarnings, Number(wallet.balance));
      await db.update(walletsTable).set({
        balance: sql`${walletsTable.balance} - ${deduct}`,
        totalEarned: sql`GREATEST(0, ${walletsTable.totalEarned} - ${creatorEarnings})`,
      }).where(eq(walletsTable.id, wallet.id));
    }

    const refundRef = `REFUND-PROD-${purchaseRef}-${Date.now()}`;
    await db.insert(transactionsTable).values({
      userId: tx.userId,
      type: "withdrawal",
      amount: String(creatorEarnings),
      currency: "NGN",
      description: `Refund for product purchase (ref: ${purchaseRef})`,
      reference: refundRef,
      status: "completed",
      metadata: JSON.stringify({ source: "product_refund", originalRef: purchaseRef }),
    });

    await db.update(productPurchasesTable).set({
      status: "refunded",
      refundedAt: new Date(),
      refundReference: refundRef,
    }).where(eq(productPurchasesTable.id, purchase.id));

    if (purchase.buyerEmail) {
      await sendRefundConfirmation({
        buyerEmail: purchase.buyerEmail,
        buyerName: purchase.buyerName ?? "Customer",
        amountNgn: Number(purchase.amount),
        reference: purchaseRef,
      });
    }
  }

  res.json({ success: true, message: "Refund processed" });
});

// ─── Tip & Marketplace internal helpers ──────────────────────────────────────

async function fulfillTip(
  creatorId: number,
  amountKobo: number,
  reference: string,
  details: { tipperName?: string; tipperEmail?: string; isAnonymous?: boolean; message?: string | null },
) {
  const [existing] = await db
    .select({ id: tipsTable.id, status: tipsTable.status })
    .from(tipsTable)
    .where(eq(tipsTable.reference, reference));

  if (existing?.status === "completed") return;

  const amountNgn = amountKobo / 100;
  const feePercent = await getPlatformFeePercent();
  const creatorEarnings = amountNgn * (1 - feePercent / 100);

  if (existing) {
    await db.update(tipsTable).set({ status: "completed" }).where(eq(tipsTable.reference, reference));
  } else {
    await db.insert(tipsTable).values({
      creatorId,
      tipperName: details.isAnonymous ? null : (details.tipperName ?? null),
      tipperEmail: details.isAnonymous ? null : (details.tipperEmail ?? null),
      isAnonymous: details.isAnonymous ?? false,
      message: details.message ?? null,
      amount: String(amountNgn),
      currency: "NGN",
      reference,
      status: "completed",
    });
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, creatorId));
  if (wallet) {
    await db.update(walletsTable).set({
      balance: sql`${walletsTable.balance} + ${creatorEarnings}`,
      totalEarned: sql`${walletsTable.totalEarned} + ${creatorEarnings}`,
    }).where(eq(walletsTable.id, wallet.id));
  } else {
    await db.insert(walletsTable).values({
      userId: creatorId,
      balance: String(creatorEarnings),
      totalEarned: String(creatorEarnings),
      totalWithdrawn: "0.00",
      currency: "NGN",
    });
  }

  const displayName = details.isAnonymous ? "Anonymous" : (details.tipperName ?? "Anonymous");
  await db.insert(transactionsTable).values({
    userId: creatorId,
    type: "earning",
    amount: String(creatorEarnings),
    currency: "NGN",
    description: `Tip from ${displayName}${details.message ? `: "${details.message.slice(0, 50)}"` : ""}`,
    reference,
    status: "completed",
    metadata: JSON.stringify({ source: "tip", tipperName: displayName, message: details.message }),
  });

  await db.insert(notificationsTable).values({
    userId: creatorId,
    type: "tip",
    title: "💸 New tip received!",
    message: `${displayName} sent you ₦${creatorEarnings.toLocaleString("en-NG", { maximumFractionDigits: 2 })}${details.message ? ` with a message: "${details.message.slice(0, 80)}"` : ""}`,
    data: JSON.stringify({ reference, tipperName: displayName, amount: creatorEarnings }),
  });

  const [creator] = await db.select().from(profilesTable).where(eq(profilesTable.id, creatorId));
  if (creator?.email) {
    await sendTipReceivedNotification({
      creatorEmail: creator.email,
      creatorName: creator.name ?? "Creator",
      tipperName: displayName,
      amountNgn: creatorEarnings,
      message: details.message ?? null,
    });
  }
}

async function fulfillMarketplaceOrder(
  listingId: number,
  sellerId: number,
  amountKobo: number,
  reference: string,
  details: { buyerEmail: string; buyerName?: string; message?: string | null; requirements?: string | null },
) {
  const [existing] = await db
    .select({ id: marketplaceOrdersTable.id, status: marketplaceOrdersTable.status })
    .from(marketplaceOrdersTable)
    .where(eq(marketplaceOrdersTable.reference, reference));

  if (existing?.status === "paid" || existing?.status === "completed") return;

  const amountNgn = amountKobo / 100;
  const feePercent = await getPlatformFeePercent();
  const sellerEarnings = amountNgn * (1 - feePercent / 100);

  const [listing] = await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.id, listingId));

  if (existing) {
    await db.update(marketplaceOrdersTable).set({ status: "paid" }).where(eq(marketplaceOrdersTable.reference, reference));
  } else {
    await db.insert(marketplaceOrdersTable).values({
      listingId,
      sellerId,
      buyerEmail: details.buyerEmail,
      buyerName: details.buyerName ?? null,
      amount: String(amountNgn),
      currency: "NGN",
      reference,
      status: "paid",
      message: details.message ?? null,
      requirements: details.requirements ?? null,
      deliveryDays: (listing as any)?.deliveryDays ?? null,
    });
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, sellerId));
  if (wallet) {
    await db.update(walletsTable).set({
      balance: sql`${walletsTable.balance} + ${sellerEarnings}`,
      totalEarned: sql`${walletsTable.totalEarned} + ${sellerEarnings}`,
    }).where(eq(walletsTable.id, wallet.id));
  } else {
    await db.insert(walletsTable).values({
      userId: sellerId,
      balance: String(sellerEarnings),
      totalEarned: String(sellerEarnings),
      totalWithdrawn: "0.00",
      currency: "NGN",
    });
  }

  await db.insert(transactionsTable).values({
    userId: sellerId,
    type: "earning",
    amount: String(sellerEarnings),
    currency: "NGN",
    description: `Marketplace order: ${listing?.title ?? "Service"} (after ${feePercent}% fee)`,
    reference,
    status: "completed",
    metadata: JSON.stringify({ source: "marketplace_order", listingId, buyerEmail: details.buyerEmail }),
  });

  await db.insert(notificationsTable).values({
    userId: sellerId,
    type: "order",
    title: "📦 New marketplace order!",
    message: `${details.buyerName ?? "A client"} placed an order for "${listing?.title ?? "your service"}" — ₦${sellerEarnings.toLocaleString("en-NG", { maximumFractionDigits: 2 })} earned.`,
    data: JSON.stringify({ listingId, reference, buyerEmail: details.buyerEmail, amount: sellerEarnings }),
  });

  const [seller] = await db.select().from(profilesTable).where(eq(profilesTable.id, sellerId));
  if (seller?.email) {
    await sendMarketplaceOrderNotification({
      sellerEmail: seller.email,
      sellerName: seller.name ?? "Creator",
      listingTitle: listing?.title ?? "Service",
      buyerName: details.buyerName ?? "Client",
      buyerEmail: details.buyerEmail,
      amountNgn: sellerEarnings,
      requirements: details.requirements ?? null,
      reference,
    });
  }
}

export default router;
