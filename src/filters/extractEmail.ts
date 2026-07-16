const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// The LinkedIn scraper appends "\n\nContact: a@b.com, c@d.com" when it's already extracted
// a clean, authoritative email (mailto: links). Prefer that over scanning the raw body
// text: a page's rendered text can concatenate visually-separated elements with no
// whitespace (e.g. "...reach out on" + "x@y.com" + "CC:..." all glued together with no
// space), which makes a naive whole-text regex scan swallow adjacent words into the match
// (e.g. "onx@y.comCC"). Falling back to a full-text scan still catches a recruiting
// mailbox (careers@/hr@/etc.) typed as plain visible text rather than a mailto: link.
const CONTACT_LINE_REGEX = /Contact:\s*(.+)/i;

export function extractEmail(descriptionText: string): string | null {
  const contactLine = descriptionText.match(CONTACT_LINE_REGEX);
  if (contactLine) {
    const match = contactLine[1].match(EMAIL_REGEX);
    if (match) return match[0];
  }
  const match = descriptionText.match(EMAIL_REGEX);
  return match ? match[0] : null;
}
