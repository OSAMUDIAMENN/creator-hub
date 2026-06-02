# Creator Hub

A full-stack creator platform for African digital entrepreneurs — link-in-bio, digital store, content planner, AI assistant, wallet & payouts, and creator ad earnings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/creator-hub run dev` — run the React web app (port 5173)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — Express session

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Clerk
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema: `lib/db/src/schema/` — one file per domain (ads, wallets, products, posts, links, …)
- API routes: `artifacts/api-server/src/routes/` — imported and mounted in `index.ts`
- Frontend pages: `artifacts/creator-hub/src/pages/dashboard/` (authenticated) + `public-profile.tsx` (public)
- Shared components: `artifacts/creator-hub/src/components/`
- Feature limit UI: `artifacts/creator-hub/src/components/feature-limit.tsx`

## Architecture decisions

- AI uses Replit AI integration proxy — model names must match what the integration supports.
- Ad earnings stored in kobo (integer) to avoid floating-point issues; divide by 100 for ₦ display.
- Freemium approach: show all features with inline limit prompts (`FreemiumGate` component), NOT hard blocks.
- `GET /api/public-ads/active?creatorUsername=xxx` records impressions and credits the creator's wallet automatically.
- Chat memory is server-side: every `/api/ai/chat` call loads conversation history and passes it to OpenAI.

## Product

- **Link-in-bio**: Creator shares a public profile page with all links, store, and sponsored ads
- **Digital store**: Upload and sell digital products (PDFs, courses, templates); Paystack checkout
- **Content planner**: Schedule posts to TikTok/Instagram/YouTube/etc with media uploads
- **AI assistant**: Streaming chat with full memory, hook generator, caption writer, content planner
- **Wallet**: Track product earnings + ad earnings; request payouts
- **Freemium**: Free plan (5 links, 3 products) → Pro/Business for unlimited; inline upgrade prompts

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After adding a new DB schema file, run `pnpm --filter @workspace/db run push` AND `pnpm run typecheck:libs` to rebuild lib declarations before typechecking dependent packages.
- Always restart the API server workflow after changing routes or DB schema.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
