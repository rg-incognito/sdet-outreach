// LinkedIn content-search results have no separate title field — job.title holds the
// full post body (filters match/reject against the whole text). This derives a short,
// human-readable label for logs, sheet cells, and LLM prompts instead of the raw blob.
export function displayTitle(title: string): string {
  const firstLine = title.split("\n")[0].trim();
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
}
