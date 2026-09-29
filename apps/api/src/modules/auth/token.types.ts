import type { UserRole } from '@ai-tutor/shared-types';

export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  role: UserRole;
  /** Unique id for this access token. */
  jti: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  /**
   * Session id. Constant across a rotation chain, so detecting reuse of any
   * token in the chain lets us revoke the whole chain rather than one token.
   */
  sid: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}
