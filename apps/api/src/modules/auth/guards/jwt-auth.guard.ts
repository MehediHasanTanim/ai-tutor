import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '@ai-tutor/shared-types';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { AppException } from '../../../common/exceptions/app.exception';

/**
 * Registered globally in AppModule — endpoints are authenticated by default and
 * opt out with @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return isPublic ? true : super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      const expired = info instanceof Error && info.name === 'TokenExpiredError';
      throw new AppException(expired ? ErrorCode.TOKEN_EXPIRED : ErrorCode.UNAUTHORIZED, {
        cause: err ?? info,
      });
    }
    return user;
  }
}
