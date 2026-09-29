/**
 * Error contract — doc 07 §5.3.
 *
 * Every endpoint returns the same envelope on failure, and every error code
 * carries a Bangla user-facing string. A code without a Bangla message is a
 * contract violation, not a TODO: `ERROR_MESSAGES` is typed as a total record
 * over `ErrorCode`, so the compiler enforces it.
 */

export const ErrorCode = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_REUSED: 'TOKEN_REUSED',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',

  // Registration
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',

  // Validation / requests
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',

  // Quota / rate limiting
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',

  // AI
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  IMAGE_UNREADABLE: 'IMAGE_UNREADABLE',
  CONTENT_NOT_IN_CURRICULUM: 'CONTENT_NOT_IN_CURRICULUM',

  // Infrastructure
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  code: ErrorCode;
  /** English message, for developers and logs. */
  message: string;
  /** Bangla message, safe to show a student directly. */
  message_bn: string;
  /** Correlates the response with server logs. Always present. */
  request_id: string;
  /** Field-level detail for VALIDATION_ERROR. Omitted otherwise. */
  details?: Record<string, string[]>;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

interface ErrorDefinition {
  status: number;
  message: string;
  message_bn: string;
}

export const ERROR_MESSAGES: Record<ErrorCode, ErrorDefinition> = {
  UNAUTHORIZED: {
    status: 401,
    message: 'Authentication required',
    message_bn: 'অনুগ্রহ করে লগইন করুন',
  },
  INVALID_CREDENTIALS: {
    status: 401,
    message: 'Invalid credentials',
    message_bn: 'ভুল তথ্য দিয়েছেন, আবার চেষ্টা করুন',
  },
  TOKEN_EXPIRED: {
    status: 401,
    message: 'Token has expired',
    message_bn: 'সেশনের মেয়াদ শেষ হয়েছে, আবার লগইন করুন',
  },
  TOKEN_INVALID: {
    status: 401,
    message: 'Token is invalid',
    message_bn: 'সেশনটি বৈধ নয়, আবার লগইন করুন',
  },
  TOKEN_REUSED: {
    status: 401,
    message: 'Refresh token reuse detected; all sessions revoked',
    message_bn: 'নিরাপত্তার কারণে সব সেশন বন্ধ করা হয়েছে, আবার লগইন করুন',
  },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to perform this action',
    message_bn: 'এই কাজটি করার অনুমতি আপনার নেই',
  },
  ACCOUNT_SUSPENDED: {
    status: 403,
    message: 'This account is suspended',
    message_bn: 'আপনার অ্যাকাউন্টটি সাময়িকভাবে বন্ধ আছে',
  },
  EMAIL_ALREADY_EXISTS: {
    status: 409,
    message: 'An account with this email already exists',
    message_bn: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে',
  },
  PHONE_ALREADY_EXISTS: {
    status: 409,
    message: 'An account with this phone number already exists',
    message_bn: 'এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে',
  },
  VALIDATION_ERROR: {
    status: 400,
    message: 'Request validation failed',
    message_bn: 'দেওয়া তথ্যে সমস্যা আছে, আবার দেখুন',
  },
  NOT_FOUND: {
    status: 404,
    message: 'Resource not found',
    message_bn: 'যা খুঁজছেন তা পাওয়া যায়নি',
  },
  CONFLICT: {
    status: 409,
    message: 'Request conflicts with the current state',
    message_bn: 'অনুরোধটি বর্তমান অবস্থার সাথে সাংঘর্ষিক',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    message: 'Unsupported file type',
    message_bn: 'এই ধরনের ফাইল সমর্থিত নয়',
  },
  PAYLOAD_TOO_LARGE: {
    status: 413,
    message: 'File is too large',
    message_bn: 'ফাইলটি অনেক বড়',
  },
  QUOTA_EXCEEDED: {
    status: 429,
    message: 'Daily question limit reached',
    message_bn: 'আজকের প্রশ্নের সীমা শেষ হয়েছে',
  },
  RATE_LIMITED: {
    status: 429,
    message: 'Too many requests. Please slow down',
    message_bn: 'একটু ধীরে চেষ্টা করুন',
  },
  SUBSCRIPTION_REQUIRED: {
    status: 402,
    message: 'This feature requires a premium subscription',
    message_bn: 'এই সুবিধাটি প্রিমিয়াম সাবস্ক্রিপশনের জন্য',
  },
  AI_PROVIDER_ERROR: {
    status: 502,
    message: 'The AI service returned an error',
    message_bn: 'উত্তর তৈরি করা যায়নি, একটু পরে আবার চেষ্টা করুন',
  },
  AI_TIMEOUT: {
    status: 504,
    message: 'The AI service took too long to respond',
    message_bn: 'উত্তর আসতে অনেক সময় লাগছে, আবার চেষ্টা করুন',
  },
  IMAGE_UNREADABLE: {
    status: 422,
    message: 'The question could not be read from this image',
    message_bn: 'ছবিটি পড়া যায়নি, আবার একটি পরিষ্কার ছবি তুলুন',
  },
  CONTENT_NOT_IN_CURRICULUM: {
    status: 404,
    message: 'This topic is not covered in the selected curriculum',
    message_bn: 'এই বিষয়টি আপনার সিলেবাসে নেই',
  },
  INTERNAL_ERROR: {
    status: 500,
    message: 'Something went wrong on our side',
    message_bn: 'কিছু একটা সমস্যা হয়েছে, একটু পরে আবার চেষ্টা করুন',
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: 'Service temporarily unavailable',
    message_bn: 'সেবাটি সাময়িকভাবে বন্ধ আছে',
  },
};
