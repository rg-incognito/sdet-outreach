import ExcelJS from "exceljs";
import { loadConfig } from "../src/config.js";
import { getOrCreateSheet } from "../src/sheets/client.js";
import { logger } from "../src/logger.js";

// One-time migration: copies every row out of the old local data/tracker.xlsx (Posts +
// Tracker sheets) into the online Google Sheet, before this project's storage switched
// from a local file to the Sheets API (see src/sheets/). Run this once, right after
// setting GOOGLE_SHEETS_SPREADSHEET_ID / GOOGLE_SERVICE_ACCOUNT_* in .env and before the
// first real `npm run run-all` against the new sheet - the Tracker sheet in particular is
// the dedup source of truth (getSentEmails in src/sheets/trackerSheet.ts), so skipping
// this step means every recruiter already emailed from the old local file would look
// unsent and could get emailed again.
const WORKBOOK_PATH = "data/tracker.xlsx";

const POSTS_HEADERS = ["Scraped At", "Title", "Company", "Recruiter Email", "Description", "Job URL"];
const TRACKER_HEADERS = [
  "Last Updated",
  "Status",
  "Job Title",
  "Company",
  "Recruiter Email",
  "ATS Score",
  "Subject",
  "Body",
  "Error",
  "Job URL",
  "Description",
];

function readLocalSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  headers: string[]
): Record<string, string>[] {
  const sheet = workbook.getWorksheet(title);
  if (!sheet) return [];

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row.getCell(i + 1).text ?? "";
    });
    rows.push(obj);
  });
  return rows;
}

async function main(): Promise<void> {
  const cfg = loadConfig();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);

  const localPosts = readLocalSheet(workbook, "Posts", POSTS_HEADERS);
  const localTracker = readLocalSheet(workbook, "Tracker", TRACKER_HEADERS);
  logger.info(
    `Local workbook: ${localPosts.length} Posts row(s), ${localTracker.length} Tracker row(s).`
  );

  const postsSheet = await getOrCreateSheet(cfg, "Posts", POSTS_HEADERS);
  const existingPostUrls = new Set(
    (await postsSheet.getRows()).map((r) => String(r.get("Job URL") ?? "").trim()).filter(Boolean)
  );
  const newPosts = localPosts.filter((p) => !existingPostUrls.has(p["Job URL"].trim()));
  if (newPosts.length > 0) await postsSheet.addRows(newPosts);
  logger.info(
    `Posts: migrated ${newPosts.length} of ${localPosts.length} (${localPosts.length - newPosts.length} already present in the online sheet, skipped).`
  );

  const trackerSheet = await getOrCreateSheet(cfg, "Tracker", TRACKER_HEADERS);
  const existingEmails = new Set(
    (await trackerSheet.getRows())
      .map((r) => String(r.get("Recruiter Email") ?? "").trim().toLowerCase())
      .filter(Boolean)
  );
  const newTracker = localTracker.filter(
    (t) => !existingEmails.has(t["Recruiter Email"].trim().toLowerCase())
  );
  if (newTracker.length > 0) await trackerSheet.addRows(newTracker);
  logger.info(
    `Tracker: migrated ${newTracker.length} of ${localTracker.length} (${localTracker.length - newTracker.length} already present in the online sheet, skipped).`
  );

  logger.info("Migration complete. Open the online sheet and spot-check it before relying on it for sends.");
}

main().catch((err) => {
  logger.error(`Migration failed: ${(err as Error).stack ?? (err as Error).message}`);
  process.exit(1);
});
