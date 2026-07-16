import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = "logs";
mkdirSync(LOG_DIR, { recursive: true });

const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logFilePath = join(LOG_DIR, `run-${runTimestamp}.log`);

function write(level: string, message: string): void {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  // eslint-disable-next-line no-console
  console.log(line);
  appendFileSync(logFilePath, line + "\n");
}

export const logger = {
  info: (message: string): void => write("INFO", message),
  warn: (message: string): void => write("WARN", message),
  error: (message: string): void => write("ERROR", message),
};
