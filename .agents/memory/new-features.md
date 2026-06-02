---
name: New features built (Marketplace, Messaging, Teams, Admin Dashboard)
description: What was built and where it lives — feature overview for continuation.
---

## Features

### Creator Marketplace (`/dashboard/marketplace`)
- DB: `marketplace_listings` table (sellerId, category, serviceType, title, description, price in NGN, deliveryDays, imageUrl, fileUrl, isActive, totalOrders, rating)
- API: `artifacts/api-server/src/routes/marketplace.ts` — GET /marketplace, GET /marketplace/my, GET /marketplace/:id, POST, PUT, DELETE
- Frontend: `artifacts/creator-hub/src/pages/dashboard/marketplace.tsx` — Browse tab + My Listings tab with CRUD dialog
- Open to all subscription plans

### Team Messaging (`/dashboard/messaging`)
- DB: `team_messages` table (teamId, senderId, content), `team_activity` table (teamId, userId, action, description, entityType, entityId)
- API: `artifacts/api-server/src/routes/messaging.ts` — GET/POST /teams/:id/messages, GET/POST /teams/:id/activity
- Frontend: `artifacts/creator-hub/src/pages/dashboard/messaging.tsx` — team selector sidebar + chat tab + activity log tab, auto-polls every 5s
- Business subscription guard

### Team Accounts + Invitations
- DB: `team_invitations` table (teamId, invitedEmail, role, token, invitedBy, expiresAt, acceptedAt)
- Existing teams.tsx page handles team CRUD + member management

### Admin Dashboard (`/dashboard/admin`)
- **8-tab comprehensive admin panel**: Overview, Users, Revenue, Withdrawals, Ads, Analytics, Moderation, Settings
- DB: added `isAdmin`, `isSuspended`, `role` columns to profiles; new `platform_settings` key/value table
- API: `artifacts/api-server/src/routes/admin.ts` — complete rewrite with 20+ endpoints
- Admin auth: email-based via `ADMIN_EMAILS=kelvinosasrobert@gmail.com` env var (auto-grants isAdmin on first login)
- Features: user suspend/delete/role, subscription override, revenue dashboard, withdrawal approve/reject with notes, ad slot CRUD, platform analytics, content moderation (uploads + marketplace listings), site settings (logo URL, tagline, AdSense IDs, maintenance mode)
- Withdrawal methods: bank_transfer, paystack, flutterwave, mobile_money

**Why:** User requested all four features explicitly.
