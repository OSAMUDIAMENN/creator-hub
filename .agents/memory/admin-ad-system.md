---
name: Admin & Ad System
description: Key decisions for the admin dashboard, ad earnings, logo upload, and broadcast notifications.
---

## Ad Earnings
- `adImpressionsTable.earningsPerImpression` is stored in **kobo** (integer).
- Wallet `balance` and `totalEarned` are in **NGN** — always divide kobo by 100 before crediting wallet.
- `GET /api/public-ads/active?limit=N` returns array when limit>1, single object when limit=1, null if none.
- `?creatorUsername=X` triggers impression recording + wallet credit for that creator.

## Admin Dashboard (admin.tsx)
- 9 tabs: Overview, Users, Revenue, Withdrawals, Ads, Analytics, Moderation, Notifications, Settings.
- Users table now shows `pendingWithdrawalsAmount` column from backend.
- Broadcast notifications: `POST /admin/notifications/broadcast` with `{title, message, type}` — iterates all profiles.

## Logo Upload (Admin Settings)
- Uses object-storage `request-url` flow: POST `/api/uploads/request-url` → PUT file to `uploadURL` → set `logo_url` to `uploadURL.split("?")[0]`.
- No separate `/api/uploads` registration step needed for admin logo (just read the URL from the presigned URL).

## DashboardAdBanner Component
- At `artifacts/creator-hub/src/components/ui/dashboard-ad-banner.tsx`.
- Props: `count` (1-4), `layout` ("row" | "card"), `className`.
- Row layout: horizontal scrollable chips. Card layout: grid of cards.
- Fetches from `/api/public-ads/active?limit={count}` — does NOT pass creatorUsername (no earnings credit in dashboard).

## Mobile Nav
- Bottom nav in `dashboard-layout.tsx` shows 5 key items: Home, Links, Store, Wallet, Analytics.
- Full nav accessible via hamburger → Sheet (slide-in drawer).
- Credits widget shown in sidebar just above user footer.

**Why:** Separation of kobo/NGN must be preserved — the DB schema stores kobo for precision; all UI and wallet operations use NGN. Any future ad feature must follow this pattern.
