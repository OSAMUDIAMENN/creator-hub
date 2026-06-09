import OpenAI from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    // Use Replit AI Integrations proxy if available, otherwise fall back to direct OPENAI_API_KEY
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    if (!apiKey) {
      throw new Error(
        "No AI API key available. Set OPENAI_API_KEY as a secret.",
      );
    }

    _openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
  }
  return _openai;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenAI() as any)[prop];
  },
});
