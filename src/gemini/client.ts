import { GoogleGenAI } from "@google/genai";
import type { Config } from "../types.js";
import { logger } from "../logger.js";

// Pinned version names (gemini-2.5-flash-lite, gemini-2.5-flash) started 404ing with
// "no longer available to new users" for newly-created API keys (confirmed in practice)
// - Google moves the version pin forward over time and eventually cuts new keys off from
// old pins. The "-latest" alias names stay pointed at whatever Google currently
// recommends, so they don't go stale the same way. -lite for the higher free-tier daily
// quota, well-suited to this pipeline's tasks (keyword extraction, short outreach copy)
// without a meaningful quality drop for text of this kind. Override via GEMINI_MODEL /
// GEMINI_FALLBACK_MODEL in .env.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-latest";

// Beyond the primary/fallback above, try every other text-capable model this API key can
// call before giving up - request-quota errors are per-model/per-day (confirmed in
// practice: one model 404s or 429s while another on the same key works fine), so cycling
// through the whole catalog meaningfully improves the odds of finding one with quota left,
// rather than failing the whole run after just one fallback attempt.
const PREFERENCE_ORDER = ["flash-lite", "flash", "pro"];

let cachedModelChain: string[] | null = null;

// Ranks discovered models cheapest/fastest-first (flash-lite, then flash, then pro),
// with anything unrecognized (preview/experimental/image/audio models that still claim
// generateContent support) pushed to the very end as a last resort.
function byPreference(a: string, b: string): number {
  const rank = (name: string): number => {
    const i = PREFERENCE_ORDER.findIndex((p) => name.includes(p));
    return i === -1 ? PREFERENCE_ORDER.length : i;
  };
  return rank(a) - rank(b);
}

async function discoverModelChain(ai: GoogleGenAI): Promise<string[]> {
  if (cachedModelChain) return cachedModelChain;

  const discovered: string[] = [];
  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (m.name && m.supportedActions?.includes("generateContent")) {
        discovered.push(m.name.replace(/^models\//, ""));
      }
    }
  } catch (err) {
    logger.warn(`Failed to list Gemini models for the fallback chain: ${(err as Error).message}`);
  }

  const rest = discovered.filter((m) => m !== PRIMARY_MODEL && m !== FALLBACK_MODEL).sort(byPreference);
  cachedModelChain = [PRIMARY_MODEL, FALLBACK_MODEL, ...rest];
  return cachedModelChain;
}

export function createGeminiClient(cfg: Config) {
  const ai = new GoogleGenAI({ apiKey: cfg.gemini.apiKey });

  async function generateWithModel(model: string, prompt: string): Promise<string> {
    const response = await ai.models.generateContent({ model, contents: prompt });
    const text = response.text;
    if (!text) {
      throw new Error(`Gemini (${model}) returned an empty response`);
    }
    return text;
  }

  async function generateText(prompt: string): Promise<string> {
    const chain = await discoverModelChain(ai);

    let lastErr: Error | undefined;
    for (let i = 0; i < chain.length; i++) {
      const model = chain[i];
      try {
        return await generateWithModel(model, prompt);
      } catch (err) {
        lastErr = err as Error;
        const isLast = i === chain.length - 1;
        if (isLast) {
          logger.error(
            `Gemini model (${model}) failed: ${lastErr.message} — no more models left to try (${chain.length} attempted).`
          );
        } else {
          logger.warn(`Gemini model (${model}) failed: ${lastErr.message} — trying next model (${chain[i + 1]}).`);
        }
      }
    }

    throw lastErr ?? new Error("Gemini: no callable models found for this API key");
  }

  return { generateText };
}

export type GeminiClient = ReturnType<typeof createGeminiClient>;
