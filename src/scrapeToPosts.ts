import type { Config } from "./types.js";
import { linkedinScraper } from "./scrapers/linkedin.js";
import { extractEmail } from "./filters/extractEmail.js";
import { isGenericMailbox } from "./utils/isGenericMailbox.js";
import { isIndianLocation } from "./utils/isIndianLocation.js";
import { appendNewPosts } from "./excel/postsSheet.js";
import { logger } from "./logger.js";

// Shared by scripts/scrape-to-sheet.ts (scrape-only CLI) and scripts/run-all.ts
// (scrape + send in one local run): scrapes LinkedIn and writes every result with an
// extractable, non-generic recruiter email to the Posts sheet.
export async function scrapeToPosts(cfg: Config): Promise<void> {
  logger.info("Scraping LinkedIn for the Posts sheet...");

  const rawJobs = await linkedinScraper.scrape(cfg);
  logger.info(`Scraped ${rawJobs.length} raw posting(s) total.`);

  // Drop India-located postings before they ever reach the Posts sheet - same rationale
  // as the generic-mailbox filter below, just gating on job location instead of email.
  const indiaSkipped = rawJobs.filter((job) => isIndianLocation(job.descriptionText)).length;
  const jobs = rawJobs.filter((job) => !isIndianLocation(job.descriptionText));

  let genericSkipped = 0;
  const withEmails = jobs.map((job) => {
    const email = extractEmail(job.descriptionText) ?? "";
    // Generic mailboxes (ADA accommodation lines, employee-relations, compliance, etc.)
    // aren't recruiter contacts - drop them here so they never reach the Posts sheet.
    if (email && isGenericMailbox(email)) {
      genericSkipped += 1;
      return { job, recruiterEmail: "" };
    }
    return { job, recruiterEmail: email };
  });
  const withEmailCount = withEmails.filter((w) => w.recruiterEmail).length;

  const added = await appendNewPosts(withEmails);
  logger.info(
    `Added ${added} new row(s) to the Posts sheet (${withEmailCount} of ${jobs.length} non-India posting(s) had a usable recruiter email` +
      (indiaSkipped > 0 ? `, ${indiaSkipped} skipped as India-located` : "") +
      (genericSkipped > 0 ? `, ${genericSkipped} skipped as generic mailboxes` : "") +
      `).`
  );
}
