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
});

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required in .env"),
  GMAIL_USER: z.string().email("GMAIL_USER must be a valid email address"),
  // Optional at load time so --dry-run works before Gmail App Password setup;
  // sendMail.ts enforces this is set before any real (non-dry-run) send.
  GMAIL_APP_PASSWORD: z.string().default(""),
});

export function loadConfig(configPath = "config.json"): Config {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = ConfigFileSchema.parse(JSON.parse(raw));

  const env = EnvSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  });

  return {
    gemini: { apiKey: env.GEMINI_API_KEY },
    gmail: { user: env.GMAIL_USER, appPassword: env.GMAIL_APP_PASSWORD },
    search: parsed.search,
    sources: parsed.sources,
    masterResumePath: parsed.masterResumePath,
    candidateName: parsed.candidateName,
    candidatePhone: parsed.candidatePhone,
  };
}
