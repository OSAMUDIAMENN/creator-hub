---
name: Email notifications
description: Resend-powered sale emails for creator and buyer, wired into product purchase fulfillment.
---

## Setup
- Package: `resend` installed in `@workspace/api-server`
- Lib: `artifacts/api-server/src/lib/email.ts`
- Wired in: `artifacts/api-server/src/routes/paystack.ts` → `fulfillProductPurchase()`
- Secret needed: `RESEND_API_KEY` (gracefully skips with console.log when absent)
- FROM address: `CreatorHub <noreply@creatorhub.africa>` — update if domain changes

## Functions
- `sendCreatorSaleNotification()` — HTML email to creator when product sells; includes buyer name/email, sale amount, earnings after fee
- `sendBuyerConfirmation()` — HTML email to buyer with purchase details; includes download link if `product.fileUrl` set

## How applied
After the in-app notification insert in `fulfillProductPurchase`, the function:
1. Fetches creator profile (email + name) from `profilesTable` by `creatorUserId`
2. Calls `sendCreatorSaleNotification` if creator has email
3. Calls `sendBuyerConfirmation` if `buyerEmail` was captured at checkout

**Why:** Creator needs to know about sales even when not logged in; buyer needs download link delivery.
