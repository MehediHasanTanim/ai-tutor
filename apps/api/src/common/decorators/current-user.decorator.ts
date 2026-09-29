import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser, RequestWithContext } from '../request-context';

/** Injects the authenticated principal established by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithContext>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
