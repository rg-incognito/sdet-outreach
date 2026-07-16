// LinkedIn posts have no structured location field for this pipeline (see
// JobPosting.location) — location shows up as freeform text in the post/description body
// (e.g. "📍 Location: Bangalore, India" or "Hyderabad, Remote"). Reject on that text instead
// of the recruiter/company name: many US-based roles are posted by India-based recruiters
// (e.g. HCLTech, bench-sales IT recruiters), so name-based filtering would wrongly drop them.
const INDIA_LOCATION_PATTERNS: RegExp[] = [
  /\bindia\b/i,
  /\bbengaluru\b/i,
  /\bbangalore\b/i,
  /\bhyderabad\b/i,
  /\bpune\b/i,
  /\bchennai\b/i,
  /\bmumbai\b/i,
  /\bdelhi\b/i,
  /\bnoida\b/i,
  /\bgurugram\b/i,
  /\bgurgaon\b/i,
  /\bkolkata\b/i,
  /\bahmedabad\b/i,
  /\bkochi\b/i,
  /\bcochin\b/i,
  /\bcoimbatore\b/i,
  /\bindore\b/i,
  /\bjaipur\b/i,
  /\bchandigarh\b/i,
  /\bnagpur\b/i,
  /\blucknow\b/i,
  /\bsurat\b/i,
  /\bvadodara\b/i,
  /\bvisakhapatnam\b/i,
  /\btrivandrum\b/i,
  /\bthiruvananthapuram\b/i,
  /\bmysuru\b/i,
  /\bmysore\b/i,
  /\bbhopal\b/i,
  /\bpatna\b/i,
  /\bbhubaneswar\b/i,
];

export function isIndianLocation(text: string): boolean {
  return INDIA_LOCATION_PATTERNS.some((pattern) => pattern.test(text));
}
