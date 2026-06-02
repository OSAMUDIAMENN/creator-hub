---
name: AI chat fetch credentials
description: Direct fetch() calls to AI routes need credentials:"include" for Clerk auth.
---

## Rule
Any manual `fetch()` call to `/api/openai/*` routes MUST include `credentials: "include"` so Clerk session cookies are sent with the request. Without it, `requireAuth()` on the server returns 401 and the call silently fails.

**Why:** Clerk uses session cookies in SPA mode. Generated React Query hooks (from @workspace/api-client-react) handle this automatically, but hand-written fetch() calls in ai-chat.tsx and ai-chat-float.tsx do not.

**How to apply:** Always add `credentials: "include"` to fetch calls targeting authenticated API endpoints in the creator-hub frontend.
