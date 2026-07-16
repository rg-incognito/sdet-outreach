import { appendFileSync, mkdirSync } from "node:fs";

const LOG_DIR = "logs";
const AUDIT_LOG_PATH = `${LOG_DIR}/audit.log`;

export interface AuditEntry {
  recipient: string;
  jobTitle: string;
  company: string;
  jobUrl: string;
  atsScore: number;
  sentAt: string;
}

export function recordSentEmail(entry: AuditEntry): void {
  mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + "\n");
}
