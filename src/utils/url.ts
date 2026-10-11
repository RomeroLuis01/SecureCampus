/**
 * Sanitizes and validates a requested returnUrl to prevent Open Redirect attacks.
 *
 * Security Invariants:
 * 1. Must be a relative internal path starting strictly with a single '/'
 * 2. Must NOT begin with '//' (protocol-relative URL)
 * 3. Must NOT contain backslashes '\' (which some browsers normalize to '/')
 * 4. Must NOT contain control characters, newlines, or whitespace
 * 5. Must NOT point back to '/login' (to prevent redirect loops)
 * 6. Returns fallbackPath if the candidate URL is invalid or unsafe.
 */
export function sanitizeReturnUrl(candidate: string | null | undefined, fallbackPath = '/'): string {
  if (!candidate || typeof candidate !== 'string') {
    return fallbackPath;
  }

  const trimmed = candidate.trim();

  // Invariant 1 & 2: Must start with '/' but not '//'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallbackPath;
  }

  // Invariant 3: Reject backslashes
  if (trimmed.includes('\\')) {
    return fallbackPath;
  }

  // Invariant 4: Reject CRLF and control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return fallbackPath;
  }

  // Invariant 5: Prevent redirect loop back to login
  if (trimmed === '/login' || trimmed.startsWith('/login?') || trimmed.startsWith('/login/')) {
    return fallbackPath;
  }

  // Parse path with URL constructor using a dummy base to verify it remains strictly on dummy origin
  try {
    const dummyOrigin = 'http://internal.app';
    const parsed = new URL(trimmed, dummyOrigin);
    if (parsed.origin !== dummyOrigin) {
      return fallbackPath;
    }
    // Return relative pathname + search + hash
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallbackPath;
  }
}
