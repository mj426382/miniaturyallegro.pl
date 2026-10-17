import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Public auth endpoints accept JSON only (spec 01, AC-SEC-009).
 *
 * The session cookie is SameSite=None, so a plain cross-site HTML form (urlencoded, multipart or
 * text/plain – no CORS preflight) could otherwise log a victim into an attacker's account ("login
 * CSRF") and their uploads would land there. A JSON content type cannot be sent cross-site without
 * a preflight that our CORS allow-list rejects. The app, the mobile clients and the tests all send JSON.
 */
@Injectable()
export class JsonBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.is('application/json')) {
      throw new HttpException('Nieobsługiwany format żądania – wymagany JSON', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    return true;
  }
}
