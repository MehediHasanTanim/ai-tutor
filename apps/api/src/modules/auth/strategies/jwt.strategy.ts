import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import configuration from '../../../config/configuration';
import type { AuthenticatedUser } from '../../../common/request-context';
import type { AccessTokenPayload } from '../token.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(configuration.KEY)
    config: ConfigType<typeof configuration>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  /**
   * Runs on every authenticated request, so it deliberately does not hit the
   * database — the access token is short-lived (15m) and the refresh path is
   * where revocation and status are re-checked.
   */
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return { userId: payload.sub, role: payload.role, jti: payload.jti };
  }
}
