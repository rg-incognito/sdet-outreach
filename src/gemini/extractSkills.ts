import type { GeminiClient } from "./client.js";

export async function extractSkills(
  client: GeminiClient,
  jobDescription: string
): Promise<string[]> {
  const prompt = `Extract the 10-20 most important skill/technology/requirement keywords from this job description. Respond with ONLY a JSON array of lowercase strings, no other text, no markdown code fences.

Job description:
${jobDescription}`;

  const raw = await client.generateText(prompt);
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === "string");
  } catch {
    return [];
  }
}
