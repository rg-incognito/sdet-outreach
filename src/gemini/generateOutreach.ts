import type { JobPosting } from "../types.js";

export interface OutreachEmail {
  subject: string;
  body: string;
}

// Unlike JobMailer's hiring-vs-referral split, every post here was found because it
// explicitly asked candidates to send/email their resume or CV, or listed a recruiting
// contact address (careers@/hr@/recruitment@/talent@/jobs@) - there's no "ask them to
// refer you" case, so a single direct-application tone covers all of it.
export async function generateOutreach(
  client: import("./client.js").GeminiClient,
  job: JobPosting,
  matchedKeywords: string[],
  candidateName: string,
  candidatePhone: string,
  roleTitle: string,
  masterResume: string,
  candidateCurrentCTC: string,
  candidateExpectedCTC: string,
  candidateNoticePeriod: string,
  candidateLocation: string
): Promise<OutreachEmail> {
  const fallbackSubject = `${roleTitle} — ${candidateName}`;

  const signOffInstruction = candidatePhone
    ? `Sign off with the candidate's name "${candidateName}" on one line, then their phone number "${candidatePhone}" on the next line — exactly those two lines, nothing else after (no email address or other contact field; the phone number is the only extra contact detail to include).`
    : `Sign off as "${candidateName}" only — no phone number, email address, or any other contact field after the name; the message itself is the contact method.`;

  const detailLines: string[] = [];
  if (candidateCurrentCTC) detailLines.push(`Current CTC: ${candidateCurrentCTC}`);
  if (candidateExpectedCTC) detailLines.push(`Expected CTC: ${candidateExpectedCTC}`);
  if (candidateNoticePeriod) detailLines.push(`Notice Period: ${candidateNoticePeriod}`);
  if (candidateLocation) detailLines.push(`Current Location: ${candidateLocation}`);

  const detailsInstruction = detailLines.length
    ? `After mentioning the attached resume and before the closing sign-off, include this exact labeled block, one "Label: value" line per line, in this exact order, copied verbatim with no rewording, rounding, or reformatting of the values:\n${detailLines.join("\n")}`
    : `Do not include a CTC, expected CTC, notice period, or location block — none of those values were provided.`;

  const prompt = `Write a short, professional cold outreach email from a job candidate about a specific LinkedIn post. Keep it under 150 words, 2-3 short paragraphs, no generic filler. This post either explicitly asked candidates to send/email their resume or CV, or listed a recruiting contact address - write as if reaching out directly to that contact with genuine interest in the role, mentioning that your resume is attached. Reference the exact role title and company, and naturally mention 2-3 of the candidate's relevant skills from this list: ${matchedKeywords.join(", ") || "(none extracted)"}. End with a polite call to action. ${signOffInstruction}

Absolute rule, applies to the whole email including the subject: NEVER write a bracketed or angle-bracketed placeholder anywhere — no "[Recruiter Name]", "[Hiring Manager]", "[your email address]", "[your phone number]", "[Company]", "[Insert Current CTC]", or anything similar. Every one of those reads as broken, unfilled mail-merge text and is worse than just leaving it out. If a detail isn't known (e.g. the recruiter's name), don't reference it at all — write around it naturally instead.

${detailsInstruction}

Every factual claim about the candidate — years of experience, job titles held, specific skills, tools, or achievements — must be explicitly grounded in the candidate resume text given below. Do not invent, round up, estimate, or infer any number or fact that is not literally stated in that resume (for example, never state a specific total years-of-experience figure unless that exact figure appears in the resume text — including one drawn from the job post's requirements instead of the candidate's actual background). If a detail the job post emphasizes isn't verifiable from the resume, write around it in general terms rather than asserting it as fact.

Greeting: we do not know the recruiter's actual name, so greet naturally without inventing one, e.g. "Hi there," or "Hello," or address the company directly, e.g. "Hi <actual company name> team,". Pick whichever reads most natural for this specific message.

Subject line: write it like a real person would, not a templated auto-generated one. Avoid rigid patterns like "Inquiry: <Role> - <Company>", "Application for <Role> at <Company>", or "Interest in <Role> Role" — these read as cheap and robotic. Instead make it sound like a specific, individual email about this specific role, while staying short and professional.

Formatting: this is sent as a plain-text email, not HTML or markdown. Do not use **bold**, bullet points, headers, or any other markdown syntax — plain sentences and paragraphs only.

Respond as JSON only, no markdown code fences: {"subject": "...", "body": "..."}

Role: ${roleTitle}
Company: ${job.company}
Post excerpt: ${job.descriptionText.slice(0, 1500)}

Candidate resume (the only source of truth for any fact about the candidate):
${masterResume.slice(0, 4000)}`;

  const raw = await client.generateText(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { subject: fallbackSubject, body: raw };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      subject: typeof parsed.subject === "string" ? parsed.subject : fallbackSubject,
      body: typeof parsed.body === "string" ? parsed.body : raw,
    };
  } catch {
    return { subject: fallbackSubject, body: raw };
  }
}
