import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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
      // Celowo zwracamy ogólny komunikat, żeby nie ujawniać czy email istnieje
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
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
