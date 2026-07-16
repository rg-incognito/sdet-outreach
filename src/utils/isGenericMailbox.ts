// Emails embedded in a post aren't always a recruiter's inbox — things like an ADA
// accommodation-request line or an internal employee-relations mailbox turn up too (both
// seen in practice). Treat known non-recruiting mailbox patterns as "no usable email"
// before they ever reach the Posts sheet, rather than filtering at send time.
const GENERIC_LOCAL_PART_PATTERNS = [
  /^accom+odations?[-.]?request/, // matches both "accommodation" and the common "accomodation" typo (one m)
  /^ada$/,
  /^disability/,
  /^employee[-.]?relations?/,
  /^legal$/,
  /^compliance/,
  /^privacy$/,
  /^ethics$/,
  /^no[-.]?reply$/,
  /^do[-.]?not[-.]?reply$/,
  /^webmaster$/,
  /^postmaster$/,
  /^abuse$/,
  /^unsubscribe$/,
  /^bounce/,
  /^security$/,
  /^press$/,
  /^media$/,
  /^pr$/,
  /^billing$/,
  /^accounts?$/,
  /^accounting$/,
  /^finance$/,
  /^sales$/,
  /^support$/,
  /^help(desk)?$/,
  /^customer[-.]?(service|support|care)$/,
];

export function isGenericMailbox(email: string): boolean {
  const localPart = email.split("@")[0]?.toLowerCase().trim() ?? "";
  return GENERIC_LOCAL_PART_PATTERNS.some((pattern) => pattern.test(localPart));
}
