import { logger } from "../logger.js";
import { loadWorkbook, saveWorkbook, getOrCreateSheet } from "./workbook.js";

const SHEET_TITLE = "Tracker";
// Column order below - kept in sync with the getCell(n) indices in upsertTrackerRow/
// getSentEmails. One row per recruiter email (upserted, not appended-per-attempt): a
// failed attempt updates that email's existing row in place with Status "Failed" and
// whatever the AI generated, so the sheet always shows the latest known state per
// recruiter and a failed send is never silently lost or duplicated on retry.
const HEADERS = [
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
const COL = {
  lastUpdated: 1,
  status: 2,
  jobTitle: 3,
  company: 4,
  recruiterEmail: 5,
  atsScore: 6,
  subject: 7,
  body: 8,
  error: 9,
  jobUrl: 10,
  description: 11,
} as const;

export type SendStatus = "Sent" | "Failed";

export interface TrackerRow {
  updatedAt: string;
  status: SendStatus;
  jobTitle: string;
  company: string;
  recruiterEmail: string;
  atsScore: number;
  subject: string;
  body: string;
  error: string;
  jobUrl: string;
  description: string;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function rowValues(row: TrackerRow): (string | number)[] {
  const values: (string | number)[] = [];
  values[COL.lastUpdated - 1] = row.updatedAt;
  values[COL.status - 1] = row.status;
  values[COL.jobTitle - 1] = row.jobTitle;
  values[COL.company - 1] = row.company;
  values[COL.recruiterEmail - 1] = row.recruiterEmail;
  values[COL.atsScore - 1] = row.atsScore;
  values[COL.subject - 1] = row.subject;
  values[COL.body - 1] = row.body;
  values[COL.error - 1] = row.error;
  values[COL.jobUrl - 1] = row.jobUrl;
  values[COL.description - 1] = truncate(row.description, 40000);
  return values;
}

// Best-effort by design, but a failure here is loud (ERROR, not just a warning): most
// likely cause on a local file is the workbook being open in Excel and locked for
// writing. Since Status now drives retry logic (getSentEmails below), a lost write means
// a real send could be silently repeated next run - worth surfacing clearly rather than
// a quiet warning.
export async function upsertTrackerRow(row: TrackerRow): Promise<void> {
  try {
    const workbook = await loadWorkbook();
    const sheet = getOrCreateSheet(workbook, SHEET_TITLE, HEADERS);

    const targetEmail = row.recruiterEmail.trim().toLowerCase();
    let existingRowNumber: number | null = null;
    sheet.eachRow((r, rowNumber) => {
      if (rowNumber === 1 || existingRowNumber !== null) return;
      if ((r.getCell(COL.recruiterEmail).text ?? "").trim().toLowerCase() === targetEmail) {
        existingRowNumber = rowNumber;
      }
    });

    if (existingRowNumber !== null) {
      sheet.getRow(existingRowNumber).values = rowValues(row);
    } else {
      sheet.addRow(rowValues(row));
    }

    await saveWorkbook(workbook);
  } catch (err) {
    logger.error(
      `Failed to update tracker row for ${row.recruiterEmail} (is data/tracker.xlsx open in Excel? close it and re-run): ${(err as Error).message}. ` +
        `This recruiter's send status was NOT recorded - it may be emailed again next run.`
    );
  }
}

// Dedup source of truth for the send step: only emails whose latest Tracker row has
// Status "Sent" count as "already sent to" - a row left in "Failed" status is treated as
// still pending, so the next run automatically retries it.
export async function getSentEmails(): Promise<Set<string>> {
  try {
    const workbook = await loadWorkbook();
    const sheet = workbook.getWorksheet(SHEET_TITLE);
    if (!sheet) return new Set();

    const emails = new Set<string>();
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const status = row.getCell(COL.status).text?.trim();
      const email = row.getCell(COL.recruiterEmail).text?.trim().toLowerCase();
      if (email && status === "Sent") emails.add(email);
    });
    return emails;
  } catch (err) {
    logger.warn(`Failed to read tracker sheet for dedup: ${(err as Error).message}`);
    return new Set();
  }
}
