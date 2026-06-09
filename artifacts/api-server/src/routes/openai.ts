import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  SendOpenaiMessageParams,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  GenerateContentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/openai/conversations", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const convos = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.clerkUserId, userId));

  res.json(
    convos.map((c: any) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
    }))
  );
});

router.post("/openai/conversations", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [convo] = await db
    .insert(conversationsTable)
    .values({ clerkUserId: userId, title: parsed.data.title })
    .returning();

  res.status(201).json({
    id: convo.id,
    title: convo.title,
    createdAt: convo.createdAt.toISOString(),
  });
});

router.get("/openai/conversations/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetOpenaiConversationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [convo] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, params.data.id), eq(conversationsTable.clerkUserId, userId)));

  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.id));

  res.json({
    id: convo.id,
    title: convo.title,
    createdAt: convo.createdAt.toISOString(),
    messages: msgs.map((m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

router.patch("/openai/conversations/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { title } = req.body as { title?: string };
  if (!title || !title.trim()) { res.status(400).json({ error: "Title is required" }); return; }

  const [updated] = await db
    .update(conversationsTable)
    .set({ title: title.trim() })
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.clerkUserId, userId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: updated.id, title: updated.title, createdAt: updated.createdAt.toISOString() });
});

router.delete("/openai/conversations/:id", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteOpenaiConversationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [convo] = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, params.data.id), eq(conversationsTable.clerkUserId, userId)));

  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.delete(messagesTable).where(eq(messagesTable.conversationId, params.data.id));
  await db.delete(conversationsTable).where(eq(conversationsTable.id, params.data.id));
  res.status(204).send();
});

router.get("/openai/conversations/:id/messages", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListOpenaiMessagesParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [convo] = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, params.data.id), eq(conversationsTable.clerkUserId, userId)));

  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.id));

  res.json(
    msgs.map((m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

router.post("/openai/conversations/:id/messages", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SendOpenaiMessageParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [convo] = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, params.data.id), eq(conversationsTable.clerkUserId, userId)));

  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

  const parsed = SendOpenaiMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db
    .insert(messagesTable)
    .values({ conversationId: params.data.id, role: "user", content: parsed.data.content });

  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.id));

  const chatMessages = history.map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content:
          "You are an AI content assistant for CreatorHub — a platform for African creators, influencers, and digital entrepreneurs. Help users generate content ideas, captions, hooks, and hashtags for their social media platforms. Be culturally aware of African/Nigerian context. Be creative, engaging, and practical.",
      },
      ...chatMessages,
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await db.insert(messagesTable).values({
    conversationId: params.data.id,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/openai/generate-content", requireAuth(), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = GenerateContentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { topic, niche, audience, platform } = parsed.data;

  const prompt = `You are a creative content strategist for African/Nigerian creators.

Generate content for:
- Topic: ${topic}
- Niche: ${niche}
- Target Audience: ${audience}
- Platform: ${platform ?? "General"}

Return a JSON object with EXACTLY these keys:
{
  "ideas": [array of 5 content ideas as strings],
  "captions": [array of 3 engaging captions as strings],
  "hooks": [array of 4 scroll-stopping hooks as strings],
  "hashtags": [array of 10 relevant hashtags as strings, each starting with #]
}

Return ONLY valid JSON, no explanation.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    result = { ideas: [], captions: [], hooks: [], hashtags: [] };
  }

  res.json({
    ideas: result.ideas ?? [],
    captions: result.captions ?? [],
    hooks: result.hooks ?? [],
    hashtags: result.hashtags ?? [],
  });
});

export default router;
