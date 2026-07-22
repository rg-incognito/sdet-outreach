import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Browser } from "playwright";
import type { Config, JobPosting } from "./types.js";
import { logger } from "./logger.js";
import { recordSentEmail } from "./store/auditLog.js";
import { upsertTrackerRow } from "./sheets/trackerSheet.js";
import type { GeminiClient } from "./gemini/client.js";
import { extractSkills } from "./gemini/extractSkills.js";
import { generateOutreach } from "./gemini/generateOutreach.js";
import { scoreResumeAgainstKeywords } from "./resume/atsScore.js";
import { renderResumeToPdf } from "./resume/renderPdf.js";
import { sendMail } from "./mailer/sendMail.js";
import { displayTitle } from "./utils/displayTitle.js";

function sanitizeFilename(input: string): string {
  return input
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface EmailJobResult {
  sent: boolean;
  score: number;
}

// Score the resume as-is against the post, attach it unmodified (the resume content is
// never rewritten by AI - only the outreach email is generated), send it (or log what
// would be sent under --dry-run), and record it.
//
// Every real (non-dry-run) attempt is recorded to the Tracker sheet regardless of outcome
// - whatever subject/body was generated before a failure (Gemini error, Gmail send
// error, etc.) is still written, with Status "Failed" and the error message, so nothing
// is silently lost. Because getSentEmails() (trackerSheet.ts) only treats Status "Sent"
// as dedup-blocking, a failed row is automatically retried on the next run - this
// function never throws for a mid-flight failure, it reports it via the return value and
// the Tracker row instead.
export async function tailorAndSend(
  cfg: Config,
  geminiClient: GeminiClient,
  masterResume: string,
  browser: Browser,
  job: JobPosting,
  recruiterEmail: string,
  dryRun: boolean
): Promise<EmailJobResult> {
  const roleTitle = displayTitle(job.title);
  logger.info(`Processing: ${roleTitle} @ ${job.company} (${recruiterEmail})`);

  let score = 0;
  let subject = "";
  let body = "";

  try {
    const jdKeywords = await extractSkills(geminiClient, job.descriptionText);
    const scored = scoreResumeAgainstKeywords(masterResume, jdKeywords);
    score = scored.score;

    // Attach the original resume file verbatim if it's already a PDF - no re-render, no
    // AI rewriting, exactly what was provided. Non-PDF sources (.md/.txt/.docx) still
    // need to be rendered to a PDF for the attachment, but the content itself is
    // untouched.
    let pdfBuffer: Buffer;
    if (extname(cfg.masterResumePath).toLowerCase() === ".pdf") {
      pdfBuffer = await readFile(cfg.masterResumePath);
    } else {
      mkdirSync(join("data", "resumes"), { recursive: true });
      const pdfPath = join("data", "resumes", `${sanitizeFilename(job.company)}-${sanitizeFilename(roleTitle)}.pdf`);
      pdfBuffer = await renderResumeToPdf(masterResume, pdfPath, browser);
    }

    const outreach = await generateOutreach(
      geminiClient,
      job,
      scored.matchedKeywords,
      cfg.candidateName,
      cfg.candidatePhone,
      roleTitle,
      masterResume,
      cfg.candidateCurrentCTC,
      cfg.candidateExpectedCTC,
      cfg.candidateNoticePeriod,
      cfg.candidateLocation
    );
    subject = outreach.subject;
    body = outreach.body;
    const attachmentFilename = `${sanitizeFilename(cfg.candidateName)}_Resume.pdf`;

    await sendMail(cfg, { to: recruiterEmail, subject, body, attachmentBuffer: pdfBuffer, attachmentFilename }, dryRun);

    if (dryRun) {
      logger.info(`[dry-run] ATS score: ${score} — matched keywords: ${scored.matchedKeywords.join(", ") || "(none)"}`);
      return { sent: false, score };
    }

    const sentAt = new Date().toISOString();
    recordSentEmail({
      recipient: recruiterEmail,
      jobTitle: roleTitle,
      company: job.company,
      jobUrl: job.url,
      atsScore: score,
      sentAt,
    });
    await upsertTrackerRow(cfg, {
      updatedAt: sentAt,
      status: "Sent",
      jobTitle: roleTitle,
      company: job.company,
      recruiterEmail,
      atsScore: score,
      subject,
      body,
      error: "",
      jobUrl: job.url,
      description: job.descriptionText,
    });
    return { sent: true, score };
  } catch (err) {
    const message = (err as Error).message;
    logger.error(`Failed to send to ${recruiterEmail} for ${roleTitle} @ ${job.company}: ${message}`);

    if (!dryRun) {
      await upsertTrackerRow(cfg, {
        updatedAt: new Date().toISOString(),
        status: "Failed",
        jobTitle: roleTitle,
        company: job.company,
        recruiterEmail,
        atsScore: score,
        subject,
        body,
        error: message,
        jobUrl: job.url,
        description: job.descriptionText,
      });
    }
    return { sent: false, score };
  }
}
