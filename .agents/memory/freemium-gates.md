---
name: Freemium gate pattern
description: How SubscriptionGuard works — inline banner for free users, hard block only for past_due/expired.
---

## Rule
`SubscriptionGuard` in `artifacts/creator-hub/src/components/subscription-guard.tsx` renders children for ALL users, but:
- **Free plan users**: show a colored upgrade banner at the top of the page listing the plan features, with a CTA to `/dashboard/pricing`. Children still render so users can explore.
- **Past_due / expired paid plan users**: show a hard block (no children) with a "Renew subscription" button.
- **Users who qualify**: children rendered with no banner.

**Why:** User requirement is freemium — all features accessible with inline limit prompts, never hard blocks for free users. Hard blocks only make sense when a paid subscription has lapsed.

**How to apply:** Keep `<SubscriptionGuard requiredPlan="pro">` wrappers in App.tsx. Do NOT remove them. Change behavior only in the component itself.
