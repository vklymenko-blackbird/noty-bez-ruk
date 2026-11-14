/**
 * The identity of a score file: its URL without query string and hash.
 * The Commons API appends utm_* parameters to file URLs. They name the same file,
 * so catalogue hits, live hits and library entries must compare equal without them.
 * A value that is not a URL is returned unchanged.
 */
export function normalizeFileUrl(url: string): string;
export function normalizeFileUrl(url: string | null | undefined): string | null;
export function normalizeFileUrl(url: string | null | undefined): string | null {
  if (url === null || url === undefined) return null;
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}
