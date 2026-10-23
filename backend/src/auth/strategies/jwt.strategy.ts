import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';

export type AccessTokenPayload = {
  sub: string;
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new Error('JWT_ACCESS_SECRET must be configured with at least 32 bytes');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: AccessTokenPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }
    return { id: user.id, role: user.role };
  }
}
