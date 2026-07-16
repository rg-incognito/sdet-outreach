import { loadConfig } from "../src/config.js";
import { scrapeToPosts } from "../src/scrapeToPosts.js";
import { logger } from "../src/logger.js";

// Local-only: scrapes LinkedIn directly (must run on this PC — LinkedIn needs the local
// session and a residential IP). Use scripts/run-all.ts to scrape and send in one run.
async function main(): Promise<void> {
  const cfg = loadConfig();
  await scrapeToPosts(cfg);
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
