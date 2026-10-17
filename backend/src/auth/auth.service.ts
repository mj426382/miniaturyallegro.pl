import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto, LoginDto, GoogleLoginDto } from './auth.dto';
import { canonicalEmail } from './email-canonical';
import { VERIFICATION_RESEND_COOLDOWN_MS, VERIFICATION_TOKEN_TTL_MS } from './email-verification';
import { freeCreditsForNewAccounts } from '../generation/credits.service';
import { ReferralsService } from '../referrals/referrals.service';
import { pluralPl, renderEmail } from '../notifications/email-template';
import { AccountTombstoneService } from '../users/account-tombstone.service';

// 12 rounds in production; tests lower it via BCRYPT_ROUNDS to stay fast.
const BCRYPT_ROUNDS = Math.min(14, Math.max(4, Number(process.env.BCRYPT_ROUNDS) || 12));
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const COMMON_PASSWORDS = [
  'password',
  'password1',
  'qwerty123',
  '12345678',
  'zaq12wsx',
  'admin123',
  'haslo123',
  'polska123',
  'qwerty1',
  'test1234',
];

const GENERIC_RESET_MESSAGE = 'Jeśli podany email istnieje w naszym systemie, wysłaliśmy link do resetowania hasła.';
const DUPLICATE_EMAIL_MESSAGE =
  'Konto z tym adresem email już istnieje. Adresy różniące się wielkością liter, kropkami (Gmail) albo dopiskiem „+…” traktujemy jako ten sam adres.';

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;
  private readonly googleClientId: string | undefined;
  /** Used for constant-time login failures when the e-mail does not exist. */
  private readonly dummyHash = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private referrals: ReferralsService,
    private tombstones: AccountTombstoneService,
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(this.googleClientId);
    this.freeCreditsLimit = freeCreditsForNewAccounts(this.configService.get<string>('FREE_CREDITS_LIMIT'));
  }

  /** Spec 19: free pool for accounts created now (stored on the account). */
  private readonly freeCreditsLimit: number;

  async register(dto: RegisterDto) {
    const email = dto.email;
    const emailCanonical = canonicalEmail(email);

    // One account per mailbox: aliases (+tag, Gmail dots, letter case) count as the same address.
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, { emailCanonical }] } });
    if (existing) {
      throw new ConflictException(DUPLICATE_EMAIL_MESSAGE);
    }

    this.assertPasswordNotTrivial(dto.password, email);

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    // Spec 03/20 (AC-AUTH-030, AC-REF-007): a mailbox whose account was deleted gets no second free pool
    // and no referral – neither the new account nor the link owner is rewarded.
    const returning = await this.tombstones.isTombstoned(email);
    const referredById = returning ? null : await this.referrals.resolveReferrer(dto.referralCode);
    const freeCreditsLimit = returning ? 0 : this.freeCreditsLimit;

    let user: { id: string; email: string; name: string | null; createdAt: Date; freeCreditsLimit: number };
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          emailCanonical,
          password: hashedPassword,
          name: dto.name || null,
          termsAcceptedAt: new Date(),
          marketingConsentAt: dto.marketingConsent === true ? new Date() : null,
          freeCreditsLimit,
          referredById,
        },
        select: { id: true, email: true, name: true, createdAt: true, freeCreditsLimit: true },
      });
    } catch (error: any) {
      // Two concurrent sign-ups with the same e-mail: the unique index wins the race.
      if (error?.code === 'P2002') throw new ConflictException(DUPLICATE_EMAIL_MESSAGE);
      throw error;
    }

    this.logger.log(`Nowy użytkownik zarejestrowany: ${user.id}`);

    // A mail failure must not break the sign-up – the user can resend the link from the banner.
    await this.sendVerificationEmail(user).catch((err) =>
      this.logger.error(`Nie udało się wysłać linku weryfikacyjnego do użytkownika ${user.id}: ${err?.message}`),
    );

    const { freeCreditsLimit: _pool, ...publicUser } = user;
    return { user: { ...publicUser, emailVerified: false }, token: this.generateToken(user.id, user.email) };
  }

  async login(dto: LoginDto) {
    const user = await this.findByEmailOrAlias(dto.email);

    if (!user) {
      // Run a dummy compare so response timing does not reveal whether the e-mail exists.
      await bcrypt.compare(dto.password, this.dummyHash);
      throw new UnauthorizedException('Nieprawidłowy e-mail lub hasło');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'To konto używa logowania przez Google. Użyj przycisku "Zaloguj się przez Google".',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Nieudana próba logowania dla użytkownika ${user.id}`);
      throw new UnauthorizedException('Nieprawidłowy e-mail lub hasło');
    }

    return {
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      token: this.generateToken(user.id, user.email),
    };
  }

  async googleLogin(dto: GoogleLoginDto) {
    if (!this.googleClientId) {
      throw new UnauthorizedException('Logowanie Google nie jest skonfigurowane');
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.googleToken,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (error) {
      this.logger.error(`Google auth failed: ${error?.message}`);
      throw new UnauthorizedException('Uwierzytelnianie Google nie powiodło się');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google nie udostępnił adresu e-mail');
    }
    // Linking an existing password account to a Google identity by e-mail is only safe
    // when Google has verified that address – otherwise anyone could claim an account.
    if (!payload.email_verified) {
      throw new UnauthorizedException('Adres e-mail konta Google nie został zweryfikowany');
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();

    let user = await this.prisma.user.findUnique({ where: { googleId } });
    if (!user) {
      // Google verified the mailbox, so an account on any alias of it is the same person.
      user = await this.findByEmailOrAlias(email);
    }

    if (!user) {
      // A brand-new account is a contract – the terms must be accepted explicitly, not implied.
      if (dto.acceptedTerms !== true) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            code: 'TERMS_REQUIRED',
            message: 'Aby założyć konto przez Google, zaakceptuj regulamin.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const name = [payload.given_name, payload.family_name].filter(Boolean).join(' ') || null;
      // AC-AUTH-031 / AC-REF-007: same rule as the e-mail sign-up for a mailbox of a deleted account.
      const returning = await this.tombstones.isTombstoned(email);
      try {
        user = await this.prisma.user.create({
          data: {
            email,
            emailCanonical: canonicalEmail(email),
            emailVerifiedAt: new Date(),
            googleId,
            name,
            password: null,
            termsAcceptedAt: new Date(),
            freeCreditsLimit: returning ? 0 : this.freeCreditsLimit,
            referredById: returning ? null : await this.referrals.resolveReferrer(dto.referralCode),
          },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') throw new ConflictException(DUPLICATE_EMAIL_MESSAGE);
        throw error;
      }
      this.logger.log(`Nowy użytkownik Google zarejestrowany: ${user.id}`);
      // Spec 20: Google confirms the address, so the referral bonus is paid right away.
      await this.referrals.rewardIfEligible(user.id);
    } else if (!user.googleId || !user.emailVerifiedAt) {
      // Spec 03, AC-AUTH-024 (account pre-hijacking): a password set on a never-confirmed account may
      // belong to someone who signed up with this address before its owner. Google proves the owner,
      // so that password stops working (and its sessions die); the owner can set one via the reset link.
      const dropUnconfirmedPassword = !user.emailVerifiedAt && Boolean(user.password);
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(user.googleId ? {} : { googleId }),
          ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
          ...(dropUnconfirmedPassword ? { password: null, passwordChangedAt: new Date() } : {}),
        },
      });
      this.logger.log(`Połączono konto Google z istniejącym użytkownikiem: ${user.id}`);
      // A referred account confirmed through Google instead of the e-mail link (spec 20).
      await this.referrals.rewardIfEligible(user.id);
    }

    return {
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      token: this.generateToken(user.id, user.email),
    };
  }

  /**
   * Issues a single-use reset token (1h) and e-mails a link.
   * Always responds with the same message to prevent e-mail enumeration.
   */
  async forgotPassword(email: string) {
    const user = await this.findByEmailOrAlias(email);
    if (!user) {
      return { message: GENERIC_RESET_MESSAGE };
    }

    const rawToken = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      // Invalidate previous unused tokens so only the newest link works.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
    const link = `${frontendUrl}/reset-password?token=${rawToken}`;

    // A mail outage must not turn into a 500 that only existing accounts get (e-mail enumeration).
    await this.mailService
      .send({
        to: user.email,
        subject: 'AllGrafika – resetowanie hasła',
        ...renderEmail({
          heading: 'Ustaw nowe hasło',
          paragraphs: [
            'Cześć,',
            'otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta AllGrafika. Link jest ważny przez 1 godzinę.',
          ],
          cta: { label: 'Ustaw nowe hasło', url: link },
          footer: ['Jeśli to nie Ty prosisz o zmianę hasła, zignoruj tę wiadomość – hasło pozostanie bez zmian.'],
        }),
      })
      .catch((err) =>
        this.logger.error(`Nie udało się wysłać linku resetu hasła do użytkownika ${user.id}: ${err?.message}`),
      );

    return { message: GENERIC_RESET_MESSAGE };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(rawToken) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Link do resetowania hasła jest nieprawidłowy lub wygasł');
    }

    this.assertPasswordNotTrivial(newPassword, record.user.email);
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      // Claim the token first: of two parallel requests with the same link only one may win.
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count !== 1) throw new BadRequestException('Link do resetowania hasła jest nieprawidłowy lub wygasł');
      // passwordChangedAt invalidates every JWT issued before the reset (see JwtStrategy).
      await tx.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
      });
    });

    this.logger.log(`Hasło zresetowane dla użytkownika ${record.userId}`);
    return { message: 'Hasło zostało zmienione. Możesz się teraz zalogować.' };
  }

  /** Changes the password of a logged-in user and re-issues the session (older sessions are invalidated). */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.password) {
      throw new BadRequestException(
        'To konto loguje się przez Google i nie ma hasła. Ustaw je przez „Zapomniałeś hasła?” na stronie logowania.',
      );
    }
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new BadRequestException('Obecne hasło jest nieprawidłowe');
    if (currentPassword === newPassword) throw new BadRequestException('Nowe hasło musi różnić się od obecnego');
    this.assertPasswordNotTrivial(newPassword, user.email);

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });
    this.logger.log(`Hasło zmienione przez użytkownika ${userId}`);
    return { message: 'Hasło zostało zmienione.', token: this.generateToken(user.id, user.email) };
  }

  // ─── E-mail verification (spec 13) ──────────────────────────────

  /** Confirms the mailbox. Does not log in – the link may be opened on another device. */
  async verifyEmail(rawToken: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashResetToken(rawToken) },
      include: { user: { select: { id: true, emailVerifiedAt: true } } },
    });
    if (!record) throw new BadRequestException('Link weryfikacyjny jest nieprawidłowy lub wygasł');
    // Re-opening the link after a successful confirmation is not an error for the user.
    if (record.user.emailVerifiedAt) return { verified: true, alreadyVerified: true };
    if (record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Link weryfikacyjny jest nieprawidłowy lub wygasł');
    }

    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { id: record.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    this.logger.log(`Adres e-mail potwierdzony dla użytkownika ${record.userId}`);
    // Spec 20, AC-REF-002: the referral bonus is paid once the referred address is confirmed.
    await this.referrals.rewardIfEligible(record.userId);
    return { verified: true };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true, freeCreditsLimit: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerifiedAt) return { alreadyVerified: true };

    const last = await this.prisma.emailVerificationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const waitMs = last ? last.createdAt.getTime() + VERIFICATION_RESEND_COOLDOWN_MS - Date.now() : 0;
    if (waitMs > 0) {
      throw new HttpException(
        `Link wysłaliśmy przed chwilą. Sprawdź skrzynkę (także spam) albo spróbuj ponownie za ${Math.ceil(waitMs / 1000)} s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      await this.sendVerificationEmail(user);
    } catch (err: any) {
      this.logger.error(`Nie udało się wysłać linku weryfikacyjnego do użytkownika ${userId}: ${err?.message}`);
      throw new HttpException(
        'Nie udało się wysłać wiadomości. Spróbuj ponownie za kilka minut.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { sent: true };
  }

  /** Issues a fresh single-use link (older ones stop working) and e-mails it. */
  private async sendVerificationEmail(user: { id: string; email: string; freeCreditsLimit: number }) {
    const rawToken = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        },
      }),
    ]);

    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
    const link = `${frontendUrl}/verify-email?token=${rawToken}`;
    const pool = user.freeCreditsLimit;
    // The mail promises exactly the account's own pool – none for a mailbox of a deleted account (AC-AUTH-030).
    const unlock =
      pool > 0
        ? `Potwierdź adres e-mail, aby odblokować ${pool} ${pluralPl(pool, 'darmową grafikę', 'darmowe grafiki', 'darmowych grafik')} – do sklepu internetowego albo na OLX, Vinted, eBay czy Amazon.`
        : 'Potwierdź adres e-mail, aby generować grafiki do sklepu internetowego albo na OLX, Vinted, eBay czy Amazon.';
    await this.mailService.send({
      to: user.email,
      subject: 'AllGrafika – potwierdź adres e-mail',
      ...renderEmail({
        heading: 'Potwierdź adres e-mail',
        paragraphs: [
          'Cześć,',
          `dziękujemy za założenie konta w AllGrafika. ${unlock} Link jest ważny przez 24 godziny.`,
        ],
        cta: { label: 'Potwierdź adres e-mail', url: link },
        footer: ['Jeśli konto nie zostało założone przez Ciebie, zignoruj tę wiadomość.'],
      }),
    });
  }

  /** Exact address first (legacy duplicates keep their own account), then any alias of the same mailbox. */
  private async findByEmailOrAlias(email: string) {
    const exact = await this.prisma.user.findUnique({ where: { email } });
    if (exact) return exact;
    return this.prisma.user.findUnique({ where: { emailCanonical: canonicalEmail(email) } });
  }

  private assertPasswordNotTrivial(password: string, email: string) {
    const emailPrefix = email.split('@')[0].toLowerCase();
    if (emailPrefix.length > 2 && password.toLowerCase().includes(emailPrefix)) {
      throw new BadRequestException('Hasło nie może zawierać adresu e-mail');
    }
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      throw new BadRequestException('To hasło jest zbyt popularne. Wybierz silniejsze hasło.');
    }
  }

  private generateToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email });
  }
}
