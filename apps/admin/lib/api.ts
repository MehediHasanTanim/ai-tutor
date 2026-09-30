import { readSession, writeSession, clearSession } from './session';

/**
 * Server-side API client.
 *
 * Always runs on the server — `API_BASE_URL` has no `NEXT_PUBLIC_` prefix on
 * purpose, so importing this into a client component fails loudly rather than
 * shipping the API address and a token path to the browser.
 *
 * Refreshes on 401 exactly once. The API rotates refresh tokens and treats a
 * replay as theft, revoking the whole chain, so a retry loop here would sign
 * the admin out rather than recover them.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** Thrown when there is no usable session. The layout redirects on this. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not authenticated');
    this.name = 'NotAuthenticatedError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Multipart bodies bypass JSON encoding. */
  formData?: FormData;
  /** Next's fetch cache. Defaults to no-store; this is a live admin view. */
  cache?: RequestCache;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = await readSession();
  if (!session) throw new NotAuthenticatedError();

  let response = await send(path, options, session.accessToken);

  if (response.status === 401) {
    const refreshed = await refresh(session.refreshToken);
    if (!refreshed) {
      await clearSession();
      throw new NotAuthenticatedError();
    }
    response = await send(path, options, refreshed.accessToken);
  }

  if (!response.ok) throw await toApiError(response);

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function send(path: string, options: RequestOptions, accessToken: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    // No Content-Type: fetch sets the multipart boundary itself, and setting
    // it by hand produces a boundary the server cannot parse.
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
    cache: options.cache ?? 'no-store',
  });
}

async function refresh(refreshToken: string): Promise<{ accessToken: string } | null> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    tokens?: { access_token?: string; refresh_token?: string };
  };
  const accessToken = payload.tokens?.access_token;
  const nextRefreshToken = payload.tokens?.refresh_token;

  if (!accessToken || !nextRefreshToken) return null;

  // The rotated refresh token must be stored, or the next request presents a
  // token the API has already consumed and the whole chain gets revoked.
  await writeSession({ accessToken, refreshToken: nextRefreshToken });
  return { accessToken };
}

/** Reads the API's error envelope; falls back when a proxy answered instead. */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; message_bn?: string; request_id?: string };
    };

    if (payload.error) {
      return new ApiError(
        payload.error.message ?? `Request failed (${response.status})`,
        response.status,
        payload.error.code,
        payload.error.request_id,
      );
    }
  } catch {
    // Not our envelope — a gateway page, or an empty body.
  }

  return new ApiError(`Request failed (${response.status})`, response.status);
}

/** Login is separate: it has no session yet, so it cannot use `apiFetch`. */
export async function login(
  identifier: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; role: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
    cache: 'no-store',
  });

  if (!response.ok) throw await toApiError(response);

  const payload = (await response.json()) as {
    user: { role: string };
    tokens: { access_token: string; refresh_token: string };
  };

  return {
    accessToken: payload.tokens.access_token,
    refreshToken: payload.tokens.refresh_token,
    role: payload.user.role,
  };
}
