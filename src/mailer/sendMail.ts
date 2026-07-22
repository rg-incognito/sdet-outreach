import nodemailer from "nodemailer";
import type { Config } from "../types.js";
import { logger } from "../logger.js";

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
  attachmentBuffer: Buffer;
  attachmentFilename: string;
}

export async function sendMail(
  cfg: Config,
  email: OutgoingEmail,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    logger.info(
      `[dry-run] Would send email to ${email.to} — subject: "${email.subject}"`
    );
    return;
  }

  if (!cfg.gmail.appPassword) {
    throw new Error(
      "GMAIL_APP_PASSWORD is not set in .env — cannot send real email. Set it or run with --dry-run."
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: cfg.gmail.user,
      pass: cfg.gmail.appPassword,
    },
  });

  await transporter.sendMail({
    from: cfg.candidateName ? `"${cfg.candidateName}" <${cfg.gmail.user}>` : cfg.gmail.user,
    to: email.to,
    subject: email.subject,
    text: email.body,
    attachments: [
      {
        filename: email.attachmentFilename,
        content: email.attachmentBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  logger.info(`Sent email to ${email.to} — subject: "${email.subject}"`);
}
