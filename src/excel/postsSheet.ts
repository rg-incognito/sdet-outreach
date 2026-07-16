import type { JobPosting } from "../types.js";
import { displayTitle } from "../utils/displayTitle.js";
import { loadWorkbook, saveWorkbook, getOrCreateSheet } from "./workbook.js";

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

// Appends newly-scraped posts, skipping any whose Job URL is already in the sheet (the
// local scraper runs repeatedly and will re-discover the same postings each time). Only
// entries with a non-empty recruiterEmail are worth writing at all, since the send step
// can't reach out to a posting it has no address for.
export async function appendNewPosts(
  posts: { job: JobPosting; recruiterEmail: string }[]
): Promise<number> {
  const withEmail = posts.filter((p) => p.recruiterEmail);
  if (withEmail.length === 0) return 0;

  const workbook = await loadWorkbook();
  const sheet = getOrCreateSheet(workbook, SHEET_TITLE, HEADERS);

  const existingUrls = new Set<string>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const url = row.getCell(6).text?.trim();
    if (url) existingUrls.add(url);
  });

  const newEntries = withEmail.filter(({ job }) => !existingUrls.has(job.url));
  if (newEntries.length === 0) return 0;

  for (const { job, recruiterEmail } of newEntries) {
    sheet.addRow([
      job.scrapedAt,
      displayTitle(job.title),
      job.company,
      recruiterEmail,
      truncate(job.descriptionText, 40000),
      job.url,
    ]);
  }

  await saveWorkbook(workbook);
  return newEntries.length;
}

export async function readPosts(): Promise<PostRow[]> {
  const workbook = await loadWorkbook();
  const sheet = workbook.getWorksheet(SHEET_TITLE);
  if (!sheet) return [];

  const rows: PostRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({
      scrapedAt: row.getCell(1).text ?? "",
      title: row.getCell(2).text ?? "",
      company: row.getCell(3).text ?? "",
      recruiterEmail: row.getCell(4).text ?? "",
      description: row.getCell(5).text ?? "",
      jobUrl: row.getCell(6).text ?? "",
    });
  });
  return rows;
}
