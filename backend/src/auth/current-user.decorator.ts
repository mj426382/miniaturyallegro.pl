import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** What the JWT strategy attaches to the request after a successful validation. */
export interface SessionUser {
  userId: string;
  email: string;
  /** The mailbox was confirmed (link or Google) – required for administrator rights (spec 16, AC-ADM-014). */
  emailVerified: boolean;
}

/**
 * Injects the authenticated user into a handler parameter – typed, and without exposing the
 * raw Express request. Only meaningful behind `JwtAuthGuard`.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionUser => {
  const request = ctx.switchToHttp().getRequest<{ user?: SessionUser }>();
  if (!request.user) {
    throw new Error('CurrentUser used on a route without JwtAuthGuard');
  }
  return request.user;
});
