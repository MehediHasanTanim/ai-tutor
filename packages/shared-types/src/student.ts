/**
 * Student profile contract — doc 04 "Student" section.
 *
 * `GET /api/v1/me` and `PATCH /api/v1/me`, plus subject selection. This is
 * what academic setup writes and what the router reads to decide whether
 * onboarding is complete.
 */

import type { Medium, SubscriptionPlan, SubscriptionStatus } from './enums';
import type { SubjectSummary } from './curriculum';
import type { PublicUser } from './auth';

export interface StudentProfileDetail {
  id: string;
  class_level: number;
  curriculum: { id: string; code: string; name: string; name_bn: string };
  medium: Medium;
  target_exam: string | null;
  daily_goal_minutes: number;
  preferred_language: string;
  subjects: SubjectSummary[];
  created_at: string;
  updated_at: string;
}

export interface SubscriptionSummary {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expires_at: string | null;
}

/** `GET /api/v1/me`. */
export interface MeResponse {
  user: PublicUser;
  /** Null until academic setup completes — the app's onboarding gate. */
  profile: StudentProfileDetail | null;
  subscription: SubscriptionSummary | null;
}

/**
 * `PATCH /api/v1/me`.
 *
 * Every field optional, and the same endpoint serves first-time academic
 * setup and later edits. Two endpoints would drift, and the mobile app
 * genuinely does both from the same screen.
 *
 * `subject_ids` replaces the whole selection rather than merging — a student
 * dropping a subject has to be expressible, and a merge-only API cannot do it.
 */
export interface UpdateMeRequest {
  name?: string;
  class_level?: number;
  curriculum_code?: string;
  medium?: Medium;
  target_exam?: string | null;
  daily_goal_minutes?: number;
  preferred_language?: string;
  subject_ids?: string[];
}
