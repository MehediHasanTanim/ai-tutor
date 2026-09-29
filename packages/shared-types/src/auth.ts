/**
 * Auth API contract — doc 04 "Authentication" section.
 */

import type { Medium, UserRole, UserStatus } from './enums';

export interface RegisterRequest {
  name: string;
  /** Phone-first identity (D-12 recommendation). E.164, e.g. +8801712345678. */
  phone: string;
  /** Optional secondary identifier; weak as a primary in this market. */
  email?: string;
  password: string;
}

export interface LoginRequest {
  /** Phone or email. */
  identifier: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  /** Access token lifetime, in seconds. */
  expires_in: number;
  token_type: 'Bearer';
}

export interface PublicUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface StudentProfileSummary {
  id: string;
  class_level: number;
  curriculum: string;
  medium: Medium;
  target_exam: string | null;
  daily_goal_minutes: number;
}

export interface AuthResponse {
  user: PublicUser;
  profile: StudentProfileSummary | null;
  tokens: AuthTokens;
}
