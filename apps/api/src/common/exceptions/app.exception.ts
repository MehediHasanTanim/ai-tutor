import { HttpException } from '@nestjs/common';
import { ERROR_MESSAGES, type ErrorCode } from '@ai-tutor/shared-types';

/**
 * The exception type feature code should throw.
 *
 * Carrying the `ErrorCode` rather than a bare message is what lets the global
 * filter produce the doc 07 §5.3 envelope — including the Bangla string —
 * without every call site having to remember to supply one.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: Record<string, string[]>;

  constructor(
    code: ErrorCode,
    options?: {
      /** Overrides the default English message. The Bangla string is unchanged. */
      message?: string;
      details?: Record<string, string[]>;
      cause?: unknown;
    },
  ) {
    const definition = ERROR_MESSAGES[code];
    super(options?.message ?? definition.message, definition.status, { cause: options?.cause });
    this.code = code;
    this.details = options?.details;
  }
}
