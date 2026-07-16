import { loadConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const cfg = loadConfig();
  await runPipeline(cfg, dryRun);
}

// Force exit: some dependency (Playwright's transport, the Gemini SDK's HTTP client,
// etc.) can leave a handle open that keeps the event loop alive even after all work is
// done, which would otherwise hang an unattended scheduled run indefinitely. A short
// grace delay before exiting avoids a native libuv crash on Windows ("Assertion failed:
// !(handle->flags & UV_HANDLE_CLOSING)") that occurs if process.exit() is called while a
// just-closed Playwright browser's child process handle is still being reaped.
function exitSoon(code: number): void {
  setTimeout(() => process.exit(code), 250);
}

main()
  .then(() => exitSoon(0))
  .catch((err) => {
    logger.error(`Fatal error: ${(err as Error).stack ?? (err as Error).message}`);
    exitSoon(1);
  });
