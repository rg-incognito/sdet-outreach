import type { Config } from "./types.js";
import { linkedinScraper } from "./scrapers/linkedin.js";
import { extractEmail } from "./filters/extractEmail.js";
import { isGenericMailbox } from "./utils/isGenericMailbox.js";
import { appendNewPosts, getExistingPostUrls } from "./sheets/postsSheet.js";
import { createGeminiClient } from "./gemini/client.js";
import { isOpportunityPost } from "./gemini/isOpportunityPost.js";
import { logger } from "./logger.js";

// Shared by scripts/scrape-to-sheet.ts (scrape-only CLI) and scripts/run-all.ts
// (scrape + send in one local run): scrapes LinkedIn and writes every result with an
// extractable, non-generic recruiter email from a genuine hiring post to the Posts sheet.
export async function scrapeToPosts(cfg: Config): Promise<void> {
  logger.info("Scraping LinkedIn for the Posts sheet...");

  const rawJobs = await linkedinScraper.scrape(cfg);
  logger.info(`Scraped ${rawJobs.length} raw posting(s) total.`);

  // Skip posts already in the sheet from a prior run before spending any Gemini calls on
  // them below - re-classifying the same posting on every run would waste quota for no
  // benefit, since appendNewPosts would drop the duplicate anyway.
  const existingUrls = await getExistingPostUrls(cfg);
  const jobs = rawJobs.filter((job) => !existingUrls.has(job.url));

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

  // Gemini context check: a post can carry a perfectly valid, non-generic email and still
  // not be someone actually offering a role - e.g. a candidate's own "open to work,
  // please refer me" post that happens to mention an email. Only worth the API call for
  // posts that made it this far, since anything without a usable email is dropped either
  // way. On a Gemini failure, fail open (keep the post) rather than silently dropping a
  // possibly-genuine lead over an API hiccup.
  const geminiClient = createGeminiClient(cfg);
  let notOpportunitySkipped = 0;
  const confirmed: { job: (typeof withEmails)[number]["job"]; recruiterEmail: string }[] = [];
  for (const entry of withEmails) {
    if (!entry.recruiterEmail) {
      confirmed.push(entry);
      continue;
    }
    try {
      const isOpportunity = await isOpportunityPost(geminiClient, entry.job.descriptionText);
      if (!isOpportunity) {
        notOpportunitySkipped += 1;
        confirmed.push({ job: entry.job, recruiterEmail: "" });
        continue;
      }
    } catch (err) {
      logger.warn(`Opportunity-context check failed for ${entry.job.url}, keeping it: ${(err as Error).message}`);
    }
    confirmed.push(entry);
  }
  const withEmailCount = confirmed.filter((w) => w.recruiterEmail).length;

  const added = await appendNewPosts(cfg, confirmed, existingUrls);
  logger.info(
    `Added ${added} new row(s) to the Posts sheet (${withEmailCount} of ${jobs.length} new posting(s) had a usable, genuine-opportunity recruiter email` +
      (genericSkipped > 0 ? `, ${genericSkipped} skipped as generic mailboxes` : "") +
      (notOpportunitySkipped > 0 ? `, ${notOpportunitySkipped} skipped as not actually offering an opportunity` : "") +
      `).`
  );
}
