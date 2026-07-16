import { loadConfig } from "../src/config.js";
import { scrapeToPosts } from "../src/scrapeToPosts.js";
import { runPipeline } from "../src/pipeline.js";
import { logger } from "../src/logger.js";

// Complete local run: scrape LinkedIn into the Posts sheet, then immediately tailor +
// send for every pending row - both steps in one sequential process, so there's no
// risk of the two steps opening data/tracker.xlsx at the same time (unlike two separately
// scheduled tasks). This is what scripts/register-task.ps1 schedules.
async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const cfg = loadConfig();

  await scrapeToPosts(cfg);
  await runPipeline(cfg, dryRun);
}

function exitSoon(code: number): void {
  setTimeout(() => process.exit(code), 250);
}

main()
  .then(() => exitSoon(0))
  .catch((err) => {
    logger.error(`Fatal error: ${(err as Error).stack ?? (err as Error).message}`);
    exitSoon(1);
  });
