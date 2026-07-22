import type { GeminiClient } from "./client.js";

// The cheap filters (isGenericMailbox, extractEmail) only look at
// surface signals - a candidate's own "I'm open to work, please refer me" post, or a
// comment thread that merely mentions someone else's recruiting email in passing, can
// still carry a perfectly valid-looking, non-generic email. This is the one check that
// actually reads the post's intent: is *this* post someone (a recruiter, hiring manager,
// or company) offering a role and inviting candidates to reach out, as opposed to someone
// else asking for opportunities, sharing someone else's posting secondhand, or an
// unrelated mention.
export async function isOpportunityPost(client: GeminiClient, descriptionText: string): Promise<boolean> {
  const prompt = `You are screening a LinkedIn post before a job candidate emails their resume to a contact address found in it. Decide whether this post is someone (a recruiter, hiring manager, or company) directly offering a job opening and inviting candidates to apply, send their resume, or email them for that role.

Answer NO if the post is any of these instead:
- A candidate/job-seeker themselves posting that THEY are looking for a job or open to work
- Someone asking their own network to refer them or share job openings with them
- Someone reposting, sharing, or commenting on someone else's job posting without themselves being the hiring contact
- General career advice, commentary, or an unrelated post that merely happens to contain an email address

Respond with ONLY the single word YES or NO, nothing else.

Post:
${descriptionText.slice(0, 3000)}`;

  const raw = await client.generateText(prompt);
  return /^\s*yes\b/i.test(raw);
}
