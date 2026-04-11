import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, GoogleLoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(clientId);
  }

  async register(dto: RegisterDto) {
    // Normalizacja emaila (trim + lowercase wykonywane przez DTO transformer)
    const email = dto.email;

    // Sprawdzenie czy użytkownik już istnieje
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('Konto z tym adresem email już istnieje');
    }

    // Sprawdzenie czy hasło nie zawiera emaila
    const emailPrefix = email.split('@')[0].toLowerCase();
    if (dto.password.toLowerCase().includes(emailPrefix) && emailPrefix.length > 2) {
      throw new BadRequestException('Hasło nie może zawierać adresu email');
    }

    // Sprawdzenie popularnych słabych haseł
    const commonPasswords = [
      'password', 'qwerty123', '12345678', 'zaq12wsx', 'admin123',
      'haslo123', 'polska123', 'allegro1', 'test1234',
    ];
    if (commonPasswords.includes(dto.password.toLowerCase())) {
      throw new BadRequestException('To hasło jest zbyt popularne. Wybierz silniejsze hasło.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: dto.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    this.logger.log(`Nowy użytkownik zarejestrowany: ${user.email}`);

    const token = this.generateToken(user.id, user.email);

    return { user, token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
    }

    if (!user.password) {
      throw new UnauthorizedException('To konto używa logowania przez Google. Użyj przycisku "Zaloguj się przez Google".');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Nieudana próba logowania dla: ${dto.email}`);
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
    }

    this.logger.log(`Użytkownik zalogowany: ${user.email}`);

    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async googleLogin(dto: GoogleLoginDto) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.googleToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Nieprawidłowy token Google');
      }

      const { sub: googleId, email, given_name, family_name } = payload;

      if (!email) {
        throw new UnauthorizedException('Google nie udostępnił adresu email');
      }

      // Try to find user by Google ID first, then by email
      let user = await this.prisma.user.findUnique({ where: { googleId } });

      if (!user) {
        user = await this.prisma.user.findUnique({ where: { email } });
      }

      if (!user) {
        // Create new user
        const name = [given_name, family_name].filter(Boolean).join(' ') || undefined;
        user = await this.prisma.user.create({
          data: {
            email,
            googleId,
            name,
            password: null,
          },
        });
        this.logger.log(`Nowy użytkownik Google zarejestrowany: ${email}`);
      } else if (!user.googleId) {
        // Link existing account with Google
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
        this.logger.log(`Połączono konto Google z istniejącym użytkownikiem: ${email}`);
      }

      this.logger.log(`Użytkownik zalogowany przez Google: ${email}`);

      const token = this.generateToken(user.id, user.email);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
        token,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Google auth failed: ${error.message}`);
      throw new UnauthorizedException('Uwierzytelnianie Google nie powiodło się');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'Jeśli podany email istnieje w naszym systemie, wysłaliśmy link do resetowania hasła.' };
    }
    // In production, send email with reset token
    return { message: 'Jeśli podany email istnieje w naszym systemie, wysłaliśmy link do resetowania hasła.' };
  }

  private generateToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email });
  }
}
