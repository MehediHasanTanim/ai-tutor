import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type UserRole } from '@ai-tutor/shared-types';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { AppException } from '../../../common/exceptions/app.exception';
import type { RequestWithContext } from '../../../common/request-context';

/** Enforces @Roles(). Runs after JwtAuthGuard has established the principal. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<RequestWithContext>();
    if (!user || !required.includes(user.role as UserRole)) {
      throw new AppException(ErrorCode.FORBIDDEN);
    }

    return true;
  }
}
