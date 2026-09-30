import { cookies } from 'next/headers';

/**
 * Admin session.
 *
 * Tokens live in httpOnly cookies, not `localStorage`. This panel holds an
 * admin credential that can upload to the knowledge base, so a token readable
 * by page scripts is a token any injected script can take — and the panel
 * renders document titles and chunk text that came out of uploaded PDFs.
 * Keeping the token out of JavaScript's reach removes that whole class.
 *
 * Every API call is therefore made server-side; the browser never sees a JWT.
 */

const ACCESS_COOKIE = 'admin_access';
const REFRESH_COOKIE = 'admin_refresh';

/** 30 days, matching the API's refresh TTL. */
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export async function readSession(): Promise<SessionTokens | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) return null;
  // An absent access token is fine — the fetch helper refreshes on demand.
  return { accessToken: accessToken ?? '', refreshToken };
}

export async function writeSession(tokens: SessionTokens): Promise<void> {
  const store = await cookies();
  const secure = process.env.NODE_ENV === 'production';

  store.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    // Deliberately shorter than the token's own 15 minutes, so the cookie
    // expires before the JWT does and the refresh path runs rather than the
    // API rejecting an expired token.
    maxAge: 60 * 13,
  });

  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
