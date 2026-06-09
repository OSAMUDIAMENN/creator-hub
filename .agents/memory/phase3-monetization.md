---
name: Phase 3 Monetization
description: Tips, marketplace payments, download limits, fan subscriptions, refunds, revenue analytics, configurable platform fee, fraud monitoring — all built in Phase 3.
---

## New DB tables (all pushed to Postgres)
- `tips` — tip records per creator; `isAnonymous` flag hides tipper identity
- `product_purchases` — per-purchase download count tracking; `maxDownloads` (null = unlimited) sourced from `products.downloadLimit`
- `marketplace_orders` — order lifecycle: `paid → in_progress → completed / refunded / disputed`
- `creator_subscription_tiers` — creator-defined fan tiers (max 5); `perks` stored as JSON string
- `creator_fan_subscriptions` — fan-to-creator subscriptions with Paystack sub code

## Platform fee is now DB-driven
`getPlatformFeePercent()` reads `platform_settings` key `platform_fee_percent` with fallback to 5%. Admin changes via `PATCH /api/admin/settings/platform-fee`. No restart needed.

**Why:** Hardcoded constant cannot change without redeployment; now runtime-configurable.

## Marketplace listing uses `sellerId` not `creatorId`
`marketplaceListingsTable` column is `sellerId` (not `creatorId`). Always use `listing.sellerId` when looking up the owner profile.

## Revenue source classification in analytics
Transactions are categorized by `metadata.source` field: `ad_impression`, `tip`, `marketplace_order`, or absence → product_sales. The `revenue/analytics` endpoint reads 6-month transactions and groups by label using `.toLocaleString("default", { month: "short", year: "2-digit" })` for labels.

## Download limit enforcement
`GET /api/paystack/product-download-info` checks `product_purchases.downloadCount >= maxDownloads` and returns 403. Increments count on each call. Old purchases (before Phase 3) have no `product_purchases` record → no limit enforced (graceful).

## Pre-existing TS errors (not Phase 3)
- `lib/integrations-openai-ai-server` — build config issue, pre-existing
- `admin-super.tsx` `sortOrder` + `public-profile.tsx` type issue — pre-existing
