export interface AtsScoreResult {
  score: number; // 0-100
  matchedKeywords: string[];
  missingKeywords: string[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+.#\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

export function scoreResumeAgainstKeywords(
  resumeText: string,
  jdKeywords: string[]
): AtsScoreResult {
  const resumeTokens = tokenize(resumeText);
  const resumeLower = resumeText.toLowerCase();
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const keyword of jdKeywords) {
    const keywordTokens = keyword.toLowerCase().split(/\s+/).filter(Boolean);
    const isPresent =
      resumeLower.includes(keyword.toLowerCase()) ||
      keywordTokens.every((token) => resumeTokens.has(token));

    if (isPresent) matchedKeywords.push(keyword);
    else missingKeywords.push(keyword);
  }

  const score =
    jdKeywords.length === 0
      ? 0
      : Math.round((matchedKeywords.length / jdKeywords.length) * 100);

  return { score, matchedKeywords, missingKeywords };
}
