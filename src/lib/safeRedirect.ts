/**
 * Where to send someone after they sign in: the page they were on, if it is a
 * path on this site. Anything else - an absolute URL, a protocol-relative
 * "//evil.example", a backslash trick, or a path back into the auth pages -
 * falls back to /dashboard, so a crafted link cannot bounce a fresh session to
 * another site.
 */
export function safeCallbackUrl(value: unknown, fallback = '/dashboard') {
  if (typeof value !== 'string') return fallback;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback;
  if (/[\r\n]/.test(path)) return fallback;
  if (/^\/(login|register|verify-email|reset-password)(\/|\?|$)/.test(path)) return fallback;
  return path;
}

/** `/login`, carrying the page to come back to when there is one worth keeping. */
export function loginUrl(callbackUrl?: string | null) {
  const target = safeCallbackUrl(callbackUrl, '');
  return target ? `/login?callbackUrl=${encodeURIComponent(target)}` : '/login';
}
