import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const STORAGE_STATE_PATH = "data/storageState.json";

async function main(): Promise<void> {
  mkdirSync("data", { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.linkedin.com/login");

  console.log("\nLog in to LinkedIn in the opened browser window.");
  console.log("Once you're fully logged in and see your feed, come back here and press Enter.\n");

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`Saved LinkedIn session to ${STORAGE_STATE_PATH}`);

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
