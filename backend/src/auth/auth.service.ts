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
  'allegro1',
  'test1234',
];

const GENERIC_RESET_MESSAGE = 'Jeśli podany email istnieje w naszym systemie, wysłaliśmy link do resetowania hasła.';

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
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  async register(dto: RegisterDto) {
    const email = dto.email;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Konto z tym adresem email już istnieje');
    }

    this.assertPasswordNotTrivial(dto.password, email);

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let user: { id: string; email: string; name: string | null; createdAt: Date };
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: dto.name || null,
          termsAcceptedAt: new Date(),
        },
        select: { id: true, email: true, name: true, createdAt: true },
      });
    } catch (error: any) {
      // Two concurrent sign-ups with the same e-mail: the unique index wins the race.
      if (error?.code === 'P2002') throw new ConflictException('Konto z tym adresem email już istnieje');
      throw error;
    }

    this.logger.log(`Nowy użytkownik zarejestrowany: ${user.id}`);

    return { user, token: this.generateToken(user.id, user.email) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      // Run a dummy compare so response timing does not reveal whether the e-mail exists.
      await bcrypt.compare(dto.password, this.dummyHash);
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'To konto używa logowania przez Google. Użyj przycisku "Zaloguj się przez Google".',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Nieudana próba logowania dla użytkownika ${user.id}`);
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
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
      throw new UnauthorizedException('Google nie udostępnił adresu email');
    }
    // Linking an existing password account to a Google identity by e-mail is only safe
    // when Google has verified that address – otherwise anyone could claim an account.
    if (!payload.email_verified) {
      throw new UnauthorizedException('Adres email konta Google nie został zweryfikowany');
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();

    let user = await this.prisma.user.findUnique({ where: { googleId } });
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });
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
      user = await this.prisma.user.create({
        data: { email, googleId, name, password: null, termsAcceptedAt: new Date() },
      });
      this.logger.log(`Nowy użytkownik Google zarejestrowany: ${user.id}`);
    } else if (!user.googleId) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId } });
      this.logger.log(`Połączono konto Google z istniejącym użytkownikiem: ${user.id}`);
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
    const user = await this.prisma.user.findUnique({ where: { email } });
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

    await this.mailService.send({
      to: user.email,
      subject: 'AllGrafika – resetowanie hasła',
      text: [
        'Cześć,',
        '',
        'Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta AllGrafika.',
        `Aby ustawić nowe hasło, otwórz ten link (ważny przez 1 godzinę):`,
        link,
        '',
        'Jeśli to nie Ty wysłałeś tę prośbę, zignoruj tę wiadomość – Twoje hasło pozostanie bez zmian.',
      ].join('\n'),
      html: `<p>Cześć,</p><p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta AllGrafika.</p><p><a href="${link}">Ustaw nowe hasło</a> (link ważny przez 1 godzinę).</p><p>Jeśli to nie Ty wysłałeś tę prośbę, zignoruj tę wiadomość.</p>`,
    });

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

    await this.prisma.$transaction([
      // passwordChangedAt invalidates every JWT issued before the reset (see JwtStrategy).
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
      }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

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

  private assertPasswordNotTrivial(password: string, email: string) {
    const emailPrefix = email.split('@')[0].toLowerCase();
    if (emailPrefix.length > 2 && password.toLowerCase().includes(emailPrefix)) {
      throw new BadRequestException('Hasło nie może zawierać adresu email');
    }
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      throw new BadRequestException('To hasło jest zbyt popularne. Wybierz silniejsze hasło.');
    }
  }

  private generateToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email });
  }
}
