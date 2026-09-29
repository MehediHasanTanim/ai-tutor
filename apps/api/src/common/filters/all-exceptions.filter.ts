import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ERROR_MESSAGES, ErrorCode, type ApiErrorResponse } from '@ai-tutor/shared-types';
import { AppException } from '../exceptions/app.exception';
import type { RequestWithContext } from '../request-context';

/**
 * The single place an HTTP error response is shaped — doc 07 §5.3.
 *
 * Every failure, whatever its origin, leaves the API as:
 *   { error: { code, message, message_bn, request_id, details? } }
 *
 * Unrecognised errors collapse to INTERNAL_ERROR with a generic message. The
 * real cause goes to the log with the request id attached, never to the client:
 * a Prisma error string can leak column names and query shapes.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithContext>();
    const response = ctx.getResponse<Response>();
    const requestId = request.requestId ?? 'unknown';

    const { code, message, details } = this.classify(exception);
    const definition = ERROR_MESSAGES[code];

    const body: ApiErrorResponse = {
      error: {
        code,
        message: message ?? definition.message,
        message_bn: definition.message_bn,
        request_id: requestId,
        ...(details ? { details } : {}),
      },
    };

    const logContext = `${request.method} ${request.originalUrl} -> ${code} [${requestId}]`;
    if (definition.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        logContext,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(logContext);
    }

    response.status(definition.status).json(body);
  }

  private classify(exception: unknown): {
    code: ErrorCode;
    message?: string;
    details?: Record<string, string[]>;
  } {
    if (exception instanceof AppException) {
      return { code: exception.code, message: exception.message, details: exception.details };
    }

    if (exception instanceof ThrottlerException) {
      return { code: ErrorCode.RATE_LIMITED };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception);
    }

    return { code: ErrorCode.INTERNAL_ERROR };
  }

  private fromHttpException(exception: HttpException): {
    code: ErrorCode;
    message?: string;
    details?: Record<string, string[]>;
  } {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    // ValidationPipe emits { message: string[] }. Reshape into field details.
    if (status === HttpStatus.BAD_REQUEST && isValidationPayload(payload)) {
      return {
        code: ErrorCode.VALIDATION_ERROR,
        details: groupValidationMessages(payload.message),
      };
    }

    const code = HTTP_STATUS_TO_ERROR_CODE[status] ?? ErrorCode.INTERNAL_ERROR;
    // 5xx messages are not safe to echo; 4xx ones are developer-facing hints.
    const message = status < HttpStatus.INTERNAL_SERVER_ERROR ? exception.message : undefined;
    return { code, message };
  }

  private fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): { code: ErrorCode } {
    switch (exception.code) {
      case 'P2002': // unique constraint
        return { code: ErrorCode.CONFLICT };
      case 'P2025': // record not found
        return { code: ErrorCode.NOT_FOUND };
      case 'P2003': // foreign key constraint
        return { code: ErrorCode.VALIDATION_ERROR };
      default:
        return { code: ErrorCode.INTERNAL_ERROR };
    }
  }
}

const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.PAYMENT_REQUIRED]: ErrorCode.SUBSCRIPTION_REQUIRED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.BAD_GATEWAY]: ErrorCode.AI_PROVIDER_ERROR,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
  [HttpStatus.GATEWAY_TIMEOUT]: ErrorCode.AI_TIMEOUT,
};

function isValidationPayload(payload: unknown): payload is { message: string[] } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    Array.isArray((payload as { message: unknown }).message)
  );
}

/**
 * class-validator produces flat strings like "password must be longer than…".
 * The leading token is the property name, which is enough to group by field.
 */
function groupValidationMessages(messages: string[]): Record<string, string[]> {
  return messages.reduce<Record<string, string[]>>((acc, message) => {
    const field = message.split(' ')[0] || '_';
    (acc[field] ??= []).push(message);
    return acc;
  }, {});
}
