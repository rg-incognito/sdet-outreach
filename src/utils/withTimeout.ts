// Some Playwright APIs (page.title(), browser.close(), etc.) don't accept their own
// timeout option and can hang indefinitely against a crashed/dead browser instead of
// rejecting. Race everything that touches a browser page against a hard ceiling so a
// single crash can never stall an entire run.
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}
