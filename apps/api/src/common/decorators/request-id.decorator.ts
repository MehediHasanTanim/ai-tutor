import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithContext } from '../request-context';

/** Injects the correlation id attached by RequestIdMiddleware. */
export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest<RequestWithContext>().requestId ?? 'unknown';
});
