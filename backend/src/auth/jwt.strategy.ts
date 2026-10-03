import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { hasCsrfHeader, tokenFromCookie } from './session-cookie';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      // Bearer first (explicit), then the httpOnly session cookie.
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), tokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    // Purpose-bound tokens (e.g. the Allegro OAuth `state`) are signed with the same secret
    // but must never authenticate API requests.
    if (!payload?.sub || payload.purpose) {
      throw new UnauthorizedException();
    }

    // Cookie-authenticated requests must carry the custom header (CSRF defence, see session-cookie.ts).
    const bearer = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!bearer && tokenFromCookie(req) && !hasCsrfHeader(req)) {
      throw new UnauthorizedException('Brak nagłówka X-Requested-With');
    }

    // One cheap PK lookup per request: rejects tokens of deleted users and tokens issued
    // before the last password reset (stolen sessions die with the reset).
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, passwordChangedAt: true },
    });
    if (!user) throw new UnauthorizedException();
    if (
      user.passwordChangedAt &&
      typeof payload.iat === 'number' &&
      payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000
    ) {
      throw new UnauthorizedException('Sesja wygasła po zmianie hasła. Zaloguj się ponownie.');
    }
    return { userId: user.id, email: user.email };
  }
}
