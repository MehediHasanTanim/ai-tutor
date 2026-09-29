import { Injectable, Logger } from '@nestjs/common';
import { Prisma, User, UserStatus } from '@prisma/client';
import { ErrorCode, type AuthResponse } from '@ai-tutor/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { toAuthResponse } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const PROFILE_INCLUDE = { curriculum: true } as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await this.passwords.hash(dto.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email ?? null,
          passwordHash,
        },
      });
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }

    const issued = await this.tokens.issuePair(user.id, user.role);
    this.logger.log(`Registered user ${user.id}`);

    // A freshly registered user has no profile until academic setup completes.
    return toAuthResponse(user, null, issued);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const isEmail = dto.identifier.includes('@');
    const user = await this.prisma.user.findUnique({
      where: isEmail ? { email: dto.identifier } : { phone: dto.identifier },
    });

    // Hash a dummy password when the user is absent so the response time does
    // not reveal whether the identifier exists.
    const storedHash = user?.passwordHash ?? DUMMY_ARGON2_HASH;
    const passwordMatches = await this.passwords.verify(storedHash, dto.password);

    if (!user || !passwordMatches) {
      throw new AppException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(ErrorCode.ACCOUNT_SUSPENDED);
    }

    await this.rehashIfNeeded(user, dto.password);

    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: PROFILE_INCLUDE,
    });
    const issued = await this.tokens.issuePair(user.id, user.role);

    return toAuthResponse(user, profile, issued);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    // Verify before rotating so the role baked into the new access token is
    // the user's current role, not whatever it was when the chain started.
    const payload = await this.tokens.verifyRefreshToken(refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.tokens.revokeAllSessions(payload.sub);
      throw new AppException(ErrorCode.TOKEN_INVALID);
    }

    const issued = await this.tokens.rotate(refreshToken, user.role);
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: PROFILE_INCLUDE,
    });

    return toAuthResponse(user, profile, issued);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  /**
   * Upgrades a hash written under weaker argon2 parameters. Only possible here,
   * at login, because it is the one moment the plaintext is available.
   */
  private async rehashIfNeeded(user: User, plainPassword: string): Promise<void> {
    if (!this.passwords.needsRehash(user.passwordHash)) return;

    try {
      const passwordHash = await this.passwords.hash(plainPassword);
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    } catch (error) {
      // Never fail a valid login over a background upgrade.
      this.logger.warn(`Password rehash failed for user ${user.id}: ${String(error)}`);
    }
  }

  private translateUniqueViolation(error: unknown): unknown {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return error;
    }

    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];

    if (fields.some((field) => field.includes('email'))) {
      return new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
    }
    return new AppException(ErrorCode.PHONE_ALREADY_EXISTS);
  }
}

/**
 * A real argon2id hash of a random string, used only to equalize login timing
 * for unknown identifiers. It matches nothing.
 */
const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZS1maXhlZC1zYWx0LXZhbA$0Vz3cWJ3Y5xJ8kQ1Gk7NqFhVvYQmP9cTqLZ2HcXbRfE';
