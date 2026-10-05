import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseAdminEmails } from './admin-emails';

/**
 * Operator-only endpoints. Allowed e-mails come from ADMIN_EMAILS (comma separated);
 * with the variable unset nobody is an admin.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly admins: Set<string>;

  constructor(config: ConfigService) {
    this.admins = parseAdminEmails(config.get<string>('ADMIN_EMAILS'));
  }

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    const email = String(user?.email || '').toLowerCase();
    if (!email || !this.admins.has(email)) {
      throw new ForbiddenException('Dostęp tylko dla administratora');
    }
    return true;
  }
}
