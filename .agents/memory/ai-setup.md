---
name: AI integration setup
description: Which AI provider is in use, why Replit proxy is not available, and the correct SDK param name.
---

## Rule
The Replit AI integration proxy (setupReplitAIIntegrations) requires an account upgrade — NOT available on the free tier. Do NOT attempt to call it.

The app uses OPENAI_API_KEY directly via `lib/integrations-openai-ai-server/src/client.ts` → `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`. Models: `gpt-4o` for chat/vision, `gpt-4o-mini` for content generation.

**Critical SDK v6 breaking change:** OpenAI SDK v6 chat completions use `max_tokens`, NOT `max_completion_tokens`. Using the wrong param causes every AI call to fail silently with "error sending message" on the client side.

**Why:** setupReplitAIIntegrations returns `{"success":false,"status":"awaiting_account_upgrade"}`. The SDK v6 renamed the param for the new Responses API but chat completions still use `max_tokens`.

**How to apply:** Always use `max_tokens` for `openai.chat.completions.create()`. Use `max_completion_tokens` only for the Responses API (`openai.responses.create()`).
