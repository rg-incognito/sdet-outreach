import { readFileSync } from "node:fs";
import { z } from "zod";
import "dotenv/config";
import type { Config } from "./types.js";

const ConfigFileSchema = z.object({
  search: z.object({
    queries: z.array(z.string()).min(1),
    maxJobsPerRun: z.number().int().positive(),
    regionGeoUrn: z.string().default(""),
  }),
  sources: z.object({
    linkedin: z.object({
      storageStatePath: z.string(),
    }),
  }),
  masterResumePath: z.string(),
  candidateName: z.string().min(1),
  candidatePhone: z.string().default(""),
  candidateCurrentCTC: z.string().default(""),
  candidateExpectedCTC: z.string().default(""),
  candidateNoticePeriod: z.string().default(""),
  candidateLocation: z.string().default(""),
});

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required in .env"),
  GMAIL_USER: z.string().email("GMAIL_USER must be a valid email address"),
  // Optional at load time so --dry-run works before Gmail App Password setup;
  // sendMail.ts enforces this is set before any real (non-dry-run) send.
  GMAIL_APP_PASSWORD: z.string().default(""),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().min(1, "GOOGLE_SHEETS_SPREADSHEET_ID is required in .env"),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z
    .string()
    .email("GOOGLE_SERVICE_ACCOUNT_EMAIL must be the service account's client_email"),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is required in .env"),
});

export function loadConfig(configPath = "config.json"): Config {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = ConfigFileSchema.parse(JSON.parse(raw));

  const env = EnvSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  });

  return {
    gemini: { apiKey: env.GEMINI_API_KEY },
    gmail: { user: env.GMAIL_USER, appPassword: env.GMAIL_APP_PASSWORD },
    sheets: {
      spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
      serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // .env can't hold a real multi-line PEM, so the private key is stored with literal
      // "\n" escape sequences - unescape them back to real newlines here, same convention
      // Google's own service-account JSON keys and the google-spreadsheet docs use.
      privateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    search: parsed.search,
    sources: parsed.sources,
    masterResumePath: parsed.masterResumePath,
    candidateName: parsed.candidateName,
    candidatePhone: parsed.candidatePhone,
    candidateCurrentCTC: parsed.candidateCurrentCTC,
    candidateExpectedCTC: parsed.candidateExpectedCTC,
    candidateNoticePeriod: parsed.candidateNoticePeriod,
    candidateLocation: parsed.candidateLocation,
  };
}
