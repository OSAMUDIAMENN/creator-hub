# Phase 3 Report — Monetization & Revenue Systems

**Date:** June 9, 2026  
**Status:** ✅ Complete

---

## Overview

Phase 3 adds a complete monetization layer to CreatorHub: tips/donations, marketplace service payments, download-limited digital products, creator fan subscription tiers, refund handling, revenue analytics dashboard, configurable platform fees, fraud monitoring, and earnings CSV export.

---

## What Was Built

### 1. Database Schema (5 new tables + 1 column)

| Table | Purpose |
|---|---|
| `tips` | Tip/donation records per creator with anonymity support |
| `product_purchases` | Per-purchase records with download count tracking and limits |
| `marketplace_orders` | Paid service orders with full order lifecycle (paid → in_progress → completed → refunded) |
| `creator_subscription_tiers` | Creator-defined fan subscription tiers (up to 5 per creator) |
| `creator_fan_subscriptions` | Fan subscriptions to creator tiers |

**Column added to `products`:** `downloadLimit INTEGER` — null = unlimited, set by creator per product.

---

### 2. Tips / Donations

- **`POST /api/paystack/tip/:username/checkout`** — Paystack checkout for tipping any creator by username. Min ₦100. Supports anonymous tipping and optional message.
- **`GET /api/paystack/tip-callback`** — Paystack redirect callback; fulfills tip, credits creator wallet (after platform fee), creates transaction record, sends in-app notification.
- **Webhook support** — `charge.success` with `type: "tip"` also handled.
- **`GET /api/tips/received`** — Creator sees all received tips.
- **`GET /api/tips/stats`** — Summary: total count, total amount, unique supporter count.
- **Email:** Creator receives "💸 You received a tip" email with tipper name and message.

---

### 3. Marketplace Service Payments

- **`POST /api/paystack/marketplace/:listingId/checkout`** — Buyer pays for a marketplace listing. Creates order with `paid` status.
- **`GET /api/paystack/marketplace-callback`** — Fulfills order, credits seller wallet (minus platform fee), sends notification.
- **Webhook support** — `charge.success` with `type: "marketplace_order"` handled.
- **Order lifecycle endpoints:**
  - `PATCH /api/marketplace-orders/:id/accept` — Seller accepts: `paid → in_progress`
  - `PATCH /api/marketplace-orders/:id/complete` — Seller marks done: `→ completed`
  - `PATCH /api/marketplace-orders/:id/dispute` — Buyer raises dispute
  - `GET /api/marketplace-orders` — Seller's orders
  - `GET /api/marketplace-orders/buying` — Buyer's orders
- **`POST /api/admin/marketplace-orders/:id/refund`** — Admin refund: reverses seller wallet earnings, creates withdrawal transaction, marks order refunded.
- **Email:** Seller receives "📦 New order received" email with buyer requirements.

---

### 4. Download Limits on Digital Products

- `downloadLimit` column on `products` (null = unlimited).
- Every paid product purchase now creates a `product_purchases` record with `downloadCount: 0` and `maxDownloads` set from the product's limit.
- **`GET /api/paystack/product-download-info`** now:
  - Checks if `downloadCount >= maxDownloads` → returns 403 with clear error.
  - Increments `downloadCount` and records `lastDownloadAt` on each access.
  - Returns `downloadCount` and `maxDownloads` in the response.

---

### 5. Creator Fan Subscriptions

- **`GET /api/creator-subs/tiers`** — Creator manages their subscription tiers (max 5).
- **`POST /api/creator-subs/tiers`** — Create a tier (name, price ≥ ₦100, interval, perks array).
- **`PATCH /api/creator-subs/tiers/:id`** — Edit name/price/perks/active status.
- **`DELETE /api/creator-subs/tiers/:id`** — Delete if no active subscribers.
- **`GET /api/creator-subs/subscribers`** — Creator sees all their fan subscribers.
- **`GET /api/public/creator-subs/:username`** — Public: anyone can see a creator's active tiers (for fan-facing UI).

---

### 6. Refund Handling

- **`POST /api/admin/products/:purchaseRef/refund`** — Admin processes product purchase refund: deducts from creator wallet balance (up to available balance), creates reverse transaction, sends buyer refund confirmation email.
- **`POST /api/admin/marketplace-orders/:id/refund`** — Admin processes marketplace order refund.
- Both write to `audit_logs` table.
- **Email:** Buyer receives "Refund confirmed" email with amount and original order reference.

---

### 7. Revenue Analytics Dashboard

- **`GET /api/revenue/analytics`** — Returns:
  - Monthly earnings for last 6 months, broken down by: `product_sales`, `ad_revenue`, `tips`, `marketplace`
  - Revenue breakdown totals (for pie/donut chart)
  - Wallet summary (balance, totalEarned, totalWithdrawn)
  - Pending withdrawals count and amount
  - Last 10 transactions

- **`GET /api/revenue/earnings-report`** — CSV export of all transactions in a date range (default last 90 days). Accepts `from` / `to` query params. Returns downloadable CSV with Date, Type, Description, Amount, Status, Reference.

**Enhanced wallet dashboard** (`wallet.tsx`):
- **Bar chart:** Monthly earnings (last 6 months) with hover tooltips.
- **Donut/pie chart:** Revenue breakdown by type (product sales, ad revenue, tips, marketplace) with color-coded legend.
- **Secondary stat cards:** Ad earnings, Tips received (count + total), Marketplace earnings.
- **New "Tips" tab:** Lists all received tips with tipper name, message, amount, date.
- **Export CSV button:** Downloads 90-day earnings report.

---

### 8. Configurable Platform Fee

- **`GET /api/admin/settings/platform-fee`** — Admin reads current fee.
- **`PATCH /api/admin/settings/platform-fee`** — Admin sets `platformFeePercent` (0–50%). Stored in `platform_settings` table with key `platform_fee_percent`.
- All payment fulfillment functions (`fulfillProductPurchase`, `fulfillTip`, `fulfillMarketplaceOrder`) now read fee from DB with fallback to 5% default.

---

### 9. Fraud Monitoring

- **`GET /api/admin/revenue/fraud-alerts`** — Returns alerts for:
  - **High:** Users with 3+ withdrawal requests in 24h.
  - **Medium:** Users withdrawing > ₦500,000 in 24h.
  - **Low:** Any single transaction > ₦100,000 in 24h.
- Returns `{ alerts: [...], generatedAt }` — admin can poll this endpoint.

---

### 10. Admin Revenue Overview

- **`GET /api/admin/revenue/overview`** — Platform-wide stats:
  - `totalPlatformEarnings` — all-time creator earnings
  - `recentEarnings30d` — last 30 days
  - `recentTransactions30d` — count
  - `pendingPayouts` — count + amount
  - `totalWithdrawn` — all-time
  - `tips` — count + total amount
  - `marketplace` — count + total amount

---

### 11. Email Notifications (3 new templates)

| Email | Trigger |
|---|---|
| **Tip received** | Creator receives when a fan tips them (with tipper name + message) |
| **Marketplace order** | Seller receives when buyer pays for a listing (with requirements) |
| **Refund confirmation** | Buyer receives when admin processes a refund |

All emails use the existing branded HTML template, gracefully skip when `RESEND_API_KEY` is not set.

---

## Files Created

| File | Description |
|---|---|
| `lib/db/src/schema/tips.ts` | Tips DB table |
| `lib/db/src/schema/product_purchases.ts` | Product purchases tracking table |
| `lib/db/src/schema/marketplace_orders.ts` | Marketplace orders table |
| `lib/db/src/schema/creator_subscription_tiers.ts` | Creator fan tier definitions |
| `lib/db/src/schema/creator_fan_subscriptions.ts` | Fan subscription records |
| `artifacts/api-server/src/routes/tips.ts` | Tips management endpoints |
| `artifacts/api-server/src/routes/revenue.ts` | Revenue analytics + fraud monitoring |
| `artifacts/api-server/src/routes/creator-subscriptions.ts` | Creator fan subscription CRUD |
| `artifacts/api-server/src/routes/marketplace-orders.ts` | Marketplace order management |

## Files Modified

| File | Changes |
|---|---|
| `lib/db/src/schema/products.ts` | Added `downloadLimit` column |
| `lib/db/src/schema/index.ts` | Exported 5 new schema modules |
| `artifacts/api-server/src/routes/paystack.ts` | Added tip/marketplace checkout + callbacks, dynamic platform fee, download limit enforcement, product + marketplace refund admin endpoints, new webhook type handlers |
| `artifacts/api-server/src/lib/email.ts` | Added 3 new email functions |
| `artifacts/api-server/src/routes/index.ts` | Mounted 4 new routers |
| `artifacts/creator-hub/src/pages/dashboard/wallet.tsx` | Added revenue charts, tips tab, analytics, CSV export |

---

## Architecture Decisions

- **Platform fee is now DB-driven:** Any change via `PATCH /api/admin/settings/platform-fee` takes effect immediately for all new transactions — no restart required.
- **Download tracking is idempotent per-reference:** The `product_purchases` record is only created once per payment reference; a missing record (e.g., old purchases before Phase 3) does not block access — it simply means no limit enforcement.
- **Refunds are soft:** Admin manually triggers them; the system deducts from wallet balance (capped at available balance) but does not interact with Paystack's actual refund API (which would require separate Paystack integration). The buyer and seller are emailed for confirmation.
- **Fan subscription tiers** store Paystack subscription code for future recurring billing integration; current checkout flow is one-time compatible with recurring via Paystack plans.
- **Revenue analytics source** is the `transactions` table, distinguished by `metadata.source` field (`ad_impression`, `tip`, `marketplace_order`, or default → product sales). No new aggregation tables needed.
- **Fraud alerts are read-only advisory** — no automatic account suspension; admins review and act manually via the existing user suspension endpoint.
