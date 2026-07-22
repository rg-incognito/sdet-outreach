import type { JobPosting, Config } from "../types.js";
import { displayTitle } from "../utils/displayTitle.js";
import { getOrCreateSheet } from "./client.js";

const SHEET_TITLE = "Posts";
const HEADERS = ["Scraped At", "Title", "Company", "Recruiter Email", "Description", "Job URL"];

export interface PostRow {
  scrapedAt: string;
  title: string;
  company: string;
  recruiterEmail: string;
  description: string;
  jobUrl: string;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

export async function getExistingPostUrls(cfg: Config): Promise<Set<string>> {
  const sheet = await getOrCreateSheet(cfg, SHEET_TITLE, HEADERS);
  const rows = await sheet.getRows();

  const urls = new Set<string>();
  for (const row of rows) {
    const url = String(row.get("Job URL") ?? "").trim();
    if (url) urls.add(url);
  }
  return urls;
}

// Appends newly-scraped posts, skipping any whose Job URL is already in the sheet (the
// local scraper runs repeatedly and will re-discover the same postings each time). Only
// entries with a non-empty recruiterEmail are worth writing at all, since the send step
// can't reach out to a posting it has no address for. Accepts an already-known set of
// existing URLs (scrapeToPosts.ts fetches it up front to gate the Gemini opportunity
// check) so this doesn't have to re-fetch the whole sheet just to dedup again.
export async function appendNewPosts(
  cfg: Config,
  posts: { job: JobPosting; recruiterEmail: string }[],
  existingUrls?: Set<string>
): Promise<number> {
  const withEmail = posts.filter((p) => p.recruiterEmail);
  if (withEmail.length === 0) return 0;

  const sheet = await getOrCreateSheet(cfg, SHEET_TITLE, HEADERS);
  const urls = existingUrls ?? (await getExistingPostUrls(cfg));

  const newEntries = withEmail.filter(({ job }) => !urls.has(job.url));
  if (newEntries.length === 0) return 0;

  await sheet.addRows(
    newEntries.map(({ job, recruiterEmail }) => ({
      "Scraped At": job.scrapedAt,
      Title: displayTitle(job.title),
      Company: job.company,
      "Recruiter Email": recruiterEmail,
      Description: truncate(job.descriptionText, 40000),
      "Job URL": job.url,
    }))
  );

  return newEntries.length;
}

export async function readPosts(cfg: Config): Promise<PostRow[]> {
  const sheet = await getOrCreateSheet(cfg, SHEET_TITLE, HEADERS);
  const rows = await sheet.getRows();

  return rows.map((row) => ({
    scrapedAt: String(row.get("Scraped At") ?? ""),
    title: String(row.get("Title") ?? ""),
    company: String(row.get("Company") ?? ""),
    recruiterEmail: String(row.get("Recruiter Email") ?? ""),
    description: String(row.get("Description") ?? ""),
    jobUrl: String(row.get("Job URL") ?? ""),
  }));
}
