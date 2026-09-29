import type { Request } from 'express';

/** Header clients and proxies use to supply or read the correlation id. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Express request augmented with the fields our middleware and guards attach. */
export interface RequestWithContext extends Request {
  requestId?: string;
  user?: AuthenticatedUser;
}

export interface AuthenticatedUser {
  userId: string;
  role: string;
  /** JWT id of the access token — lets us trace a call back to a session. */
  jti?: string;
}
