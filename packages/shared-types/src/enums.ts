/**
 * Shared enums — the single source of truth for the API contract.
 *
 * Source: doc 07 Appendix B. These are mirrored in Dart on the Flutter side;
 * drift between the two is a bug, not a style preference (doc 07 §3).
 *
 * Declared as `const` objects rather than TS `enum` so the values survive
 * `isolatedModules` and serialize predictably across the wire.
 */

export const Language = {
  BN: 'bn',
  EN: 'en',
  BANGLISH: 'banglish',
} as const;
export type Language = (typeof Language)[keyof typeof Language];

export const MessageRole = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
  SYSTEM: 'SYSTEM',
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  QUESTION: 'QUESTION',
  EXPLANATION: 'EXPLANATION',
  QUIZ: 'QUIZ',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const QuestionType = {
  MCQ: 'MCQ',
  TRUE_FALSE: 'TRUE_FALSE',
  SHORT: 'SHORT',
  NUMERICAL: 'NUMERICAL',
  CREATIVE: 'CREATIVE',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const Difficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const ImageMode = {
  SOLVE: 'SOLVE',
  EXPLAIN: 'EXPLAIN',
  HINT: 'HINT',
  SIMILAR: 'SIMILAR',
} as const;
export type ImageMode = (typeof ImageMode)[keyof typeof ImageMode];

/**
 * Resolves the contradiction noted in doc 07 §7.7: the feature spec lists four
 * quick actions, architecture §8 returned three. Four wins — `show_formula` is
 * included.
 */
export const FollowUpAction = {
  SIMPLIFY: 'simplify',
  GIVE_EXAMPLE: 'give_example',
  QUIZ_ME: 'quiz_me',
  SHOW_FORMULA: 'show_formula',
} as const;
export type FollowUpAction = (typeof FollowUpAction)[keyof typeof FollowUpAction];

export const FeedbackRating = {
  HELPFUL: 'HELPFUL',
  INCORRECT: 'INCORRECT',
  NOT_UNDERSTOOD: 'NOT_UNDERSTOOD',
  TOO_COMPLEX: 'TOO_COMPLEX',
  NOT_RELEVANT: 'NOT_RELEVANT',
} as const;
export type FeedbackRating = (typeof FeedbackRating)[keyof typeof FeedbackRating];

export const SubscriptionPlan = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
  FAMILY: 'FAMILY',
} as const;
export type SubscriptionPlan = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  PENDING: 'PENDING',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const RequestType = {
  CHAT: 'CHAT',
  IMAGE: 'IMAGE',
  QUIZ_GEN: 'QUIZ_GEN',
  EMBED: 'EMBED',
} as const;
export type RequestType = (typeof RequestType)[keyof typeof RequestType];

export const UserRole = {
  STUDENT: 'STUDENT',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const Medium = {
  BANGLA: 'BANGLA',
  ENGLISH: 'ENGLISH',
  ENGLISH_VERSION: 'ENGLISH_VERSION',
} as const;
export type Medium = (typeof Medium)[keyof typeof Medium];
