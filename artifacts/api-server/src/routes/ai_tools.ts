import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { getAuth, requireAuth } from "@clerk/express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { checkAndConsumeCredits } from "./ai_credits";

const router: IRouter = Router();

router.post("/ai-tools/hooks", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { topic, niche, platform = "all" } = req.body as { topic: string; niche: string; platform?: string };
  if (!topic || !niche) { res.status(400).json({ error: "Topic and niche required" }); return; }

  const credits = await checkAndConsumeCredits(profile.id, "hook_generator", 2);
  if (!credits.ok) { res.status(402).json({ error: `Insufficient AI credits. You have ${credits.remaining} remaining.` }); return; }

  const isAll = platform === "all";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2500,
    messages: [{
      role: "user",
      content: isAll
        ? `You are a viral content strategist for African creators.
Generate scroll-stopping hooks for topic: "${topic}" in the niche: "${niche}".
Generate 5 hooks for EACH of these platforms: TikTok, YouTube, Facebook, Instagram, X (Twitter), Reels.
Also generate 5 viral opening lines (general, ultra-viral openers).

Return ONLY valid JSON with this exact shape:
{
  "tiktok": ["hook1","hook2","hook3","hook4","hook5"],
  "youtube": ["hook1","hook2","hook3","hook4","hook5"],
  "facebook": ["hook1","hook2","hook3","hook4","hook5"],
  "instagram": ["hook1","hook2","hook3","hook4","hook5"],
  "x": ["hook1","hook2","hook3","hook4","hook5"],
  "reels": ["hook1","hook2","hook3","hook4","hook5"],
  "opening_lines": ["line1","line2","line3","line4","line5"]
}`
        : `You are a viral content strategist for African creators on ${platform}.
Generate 20 viral hooks for topic: "${topic}" in the niche: "${niche}".
Each hook must be scroll-stopping and under 150 characters.
Return ONLY a JSON object: { "hooks": ["hook1","hook2",...] }`,
    }],
    response_format: { type: "json_object" },
  });

  let result: Record<string, string[]> = {};
  try {
    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    if (isAll) {
      result = {
        tiktok: raw.tiktok ?? [],
        youtube: raw.youtube ?? [],
        facebook: raw.facebook ?? [],
        instagram: raw.instagram ?? [],
        x: raw.x ?? [],
        reels: raw.reels ?? [],
        opening_lines: raw.opening_lines ?? [],
      };
    } else {
      result = { hooks: raw.hooks ?? raw.data ?? Object.values(raw)[0] ?? [] };
    }
  } catch { result = {}; }

  res.json({ ...result, platform });
});

router.post("/ai-tools/script", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { topic, niche, duration = 60, platform = "tiktok", scriptType = "short-form" } = req.body as {
    topic: string; niche: string; duration?: number; platform?: string; scriptType?: string;
  };
  if (!topic || !niche) { res.status(400).json({ error: "Topic and niche required" }); return; }

  const credits = await checkAndConsumeCredits(profile.id, "script_generator", 3);
  if (!credits.ok) { res.status(402).json({ error: `Insufficient AI credits. You have ${credits.remaining} remaining.` }); return; }

  const styleGuide: Record<string, string> = {
    "short-form": "Fast-paced, punchy, every second counts. Hook in 3 words. Body is rapid-fire points. CTA is urgent.",
    "talking-head": "Conversational, direct-to-camera tone. Personal, relatable. Uses 'you' and 'I' frequently.",
    "storytelling": "Narrative arc: setup → conflict → resolution. Emotional, immersive. Hooks with a relatable moment.",
    "cta-endings": "Multiple strong CTA variations. Include follow, comment, share, and conversion CTAs.",
  };

  const style = styleGuide[scriptType] ?? styleGuide["short-form"];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2500,
    messages: [{
      role: "user",
      content: `You are a short-form video script writer for African creators.
Script type: ${scriptType}. Style: ${style}
Write a ${duration}-second ${platform} script about "${topic}" for the "${niche}" niche.

Return ONLY valid JSON with keys:
- hook (string): the opening 3-8 seconds
- body (string): the main content
- cta (string): call to action ending
- fullScript (string): complete script formatted with line breaks
- estimatedDuration (number in seconds)
- scriptType (string): "${scriptType}"`,
    }],
    response_format: { type: "json_object" },
  });

  let result = { hook: "", body: "", cta: "", fullScript: "", estimatedDuration: duration, scriptType };
  try { result = { ...result, ...JSON.parse(completion.choices[0]?.message?.content ?? "{}") }; } catch { /* use defaults */ }

  res.json(result);
});

router.post("/ai-tools/thumbnail-analyze", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { title, niche = "general", thumbnailBase64 } = req.body as { title: string; niche?: string; thumbnailBase64?: string };
  if (!title) { res.status(400).json({ error: "Title is required" }); return; }

  const credits = await checkAndConsumeCredits(profile.id, "thumbnail_analyzer", thumbnailBase64 ? 3 : 2);
  if (!credits.ok) { res.status(402).json({ error: `Insufficient AI credits. You have ${credits.remaining} remaining.` }); return; }

  const messages: any[] = [{
    role: "user",
    content: thumbnailBase64
      ? [
          {
            type: "text",
            text: `Analyze this YouTube/TikTok thumbnail image AND title for virality.
Title: "${title}" | Niche: ${niche}
Analyze: visual appeal, text readability, emotional trigger, color contrast, face/expression (if present), and CTR potential.
Score 1-100 for click-through potential. Give a letter grade (A-F).
Return ONLY valid JSON: { score, grade, clickability, emotionalImpact, ctrPotential, strengths, improvements, optimizedTitle, thumbnailTips }`,
          },
          { type: "image_url", image_url: { url: thumbnailBase64 } },
        ]
      : `Analyze this YouTube/TikTok video title: "${title}" in the ${niche} niche.
Score 1-100 for CTR potential. Give a letter grade.
Return ONLY valid JSON: { score, grade, clickability (string), emotionalImpact (string), ctrPotential (string), strengths (array), improvements (array), optimizedTitle (string) }`,
  }];

  const completion = await openai.chat.completions.create({
    model: thumbnailBase64 ? "gpt-4o" : "gpt-4o-mini",
    max_tokens: 1200,
    messages,
    response_format: thumbnailBase64 ? undefined : { type: "json_object" },
  });

  let result: Record<string, unknown> = { score: 50, grade: "C", strengths: [], improvements: [], optimizedTitle: title };
  try {
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch { /* use defaults */ }

  res.json(result);
});

router.get("/ai-tools/trends", requireAuth(), async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const niche = (req.query.niche as string) || "general";

  const credits = await checkAndConsumeCredits(profile.id, "trends", 1);
  if (!credits.ok) { res.status(402).json({ error: `Insufficient AI credits. You have ${credits.remaining} remaining.` }); return; }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `You are a trend analyst for African content creators.
Generate 10 highly specific trending topics for the "${niche}" niche that would perform well on TikTok, Instagram Reels, and YouTube Shorts in Nigeria/Africa right now (May 2025).
For each trend include: viral keywords to use in the video, content angles that get views.
Return ONLY valid JSON:
{
  "trends": [
    {
      "topic": "string",
      "niche": "string",
      "engagement": "Very High" | "High" | "Medium",
      "viralKeywords": ["keyword1","keyword2","keyword3"],
      "contentIdeas": ["idea1","idea2","idea3"],
      "contentAngles": ["angle1","angle2"]
    }
  ]
}`,
    }],
    response_format: { type: "json_object" },
  });

  let trends: unknown[] = [];
  try {
    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    trends = raw.trends ?? [];
  } catch { /* use defaults */ }

  res.json({ trends, niche, generatedAt: new Date().toISOString() });
});

export default router;
