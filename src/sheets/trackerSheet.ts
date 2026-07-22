import { logger } from "../logger.js";
import type { Config } from "../types.js";
import { getOrCreateSheet } from "./client.js";

const SHEET_TITLE = "Tracker";
// One row per recruiter email (upserted, not appended-per-attempt): a failed attempt
// updates that email's existing row in place with Status "Failed" and whatever the AI
// generated, so the sheet always shows the latest known state per recruiter and a failed
// send is never silently lost or duplicated on retry.
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

function rowValues(row: TrackerRow): Record<(typeof HEADERS)[number], string | number> {
  return {
    "Last Updated": row.updatedAt,
    Status: row.status,
    "Job Title": row.jobTitle,
    Company: row.company,
    "Recruiter Email": row.recruiterEmail,
    "ATS Score": row.atsScore,
    Subject: row.subject,
    Body: row.body,
    Error: row.error,
    "Job URL": row.jobUrl,
    Description: truncate(row.description, 40000),
  };
}

// Best-effort by design, but a failure here is loud (ERROR, not just a warning): the most
// likely cause is a Sheets API error (bad credentials, sheet not shared with the service
// account, quota, network). Since Status now drives retry logic (getSentEmails below), a
// lost write means a real send could be silently repeated next run - worth surfacing
// clearly rather than a quiet warning.
export async function upsertTrackerRow(cfg: Config, row: TrackerRow): Promise<void> {
  try {
    const sheet = await getOrCreateSheet(cfg, SHEET_TITLE, HEADERS);
    const rows = await sheet.getRows();

    const targetEmail = row.recruiterEmail.trim().toLowerCase();
    const existing = rows.find((r) => String(r.get("Recruiter Email") ?? "").trim().toLowerCase() === targetEmail);

    const values = rowValues(row);
    if (existing) {
      existing.assign(values);
      await existing.save();
    } else {
      await sheet.addRow(values);
    }
  } catch (err) {
    logger.error(
      `Failed to update tracker row for ${row.recruiterEmail} in the online Tracker sheet (is GOOGLE_SHEETS_SPREADSHEET_ID correct, and is it shared with the service account?): ${(err as Error).message}. ` +
        `This recruiter's send status was NOT recorded - it may be emailed again next run.`
    );
  }
}

// Dedup source of truth for the send step: only emails whose latest Tracker row has
// Status "Sent" count as "already sent to" - a row left in "Failed" status is treated as
// still pending, so the next run automatically retries it.
export async function getSentEmails(cfg: Config): Promise<Set<string>> {
  try {
    const sheet = await getOrCreateSheet(cfg, SHEET_TITLE, HEADERS);
    const rows = await sheet.getRows();

    const emails = new Set<string>();
    for (const row of rows) {
      const status = String(row.get("Status") ?? "").trim();
      const email = String(row.get("Recruiter Email") ?? "")
        .trim()
        .toLowerCase();
      if (email && status === "Sent") emails.add(email);
    }
    return emails;
  } catch (err) {
    logger.warn(`Failed to read tracker sheet for dedup: ${(err as Error).message}`);
    return new Set();
  }
}
