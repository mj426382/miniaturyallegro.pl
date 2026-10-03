import { Controller, Post, Body, HttpCode, HttpStatus, Res, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './auth.dto';
import { clearSessionCookie, setSessionCookie } from './session-cookie';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Rejestracja nowego użytkownika (sesja w cookie httpOnly + token w odpowiedzi)' })
  @ApiResponse({ status: 201, description: 'Użytkownik zarejestrowany pomyślnie' })
  @ApiResponse({ status: 400, description: 'Nieprawidłowe dane wejściowe' })
  @ApiResponse({ status: 409, description: 'Email już jest w użyciu' })
  @ApiResponse({ status: 429, description: 'Zbyt wiele prób rejestracji. Spróbuj później.' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    setSessionCookie(res, result.token);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Logowanie za pomocą email i hasła' })
  @ApiResponse({ status: 200, description: 'Zalogowano pomyślnie' })
  @ApiResponse({ status: 401, description: 'Nieprawidłowy email lub hasło' })
  @ApiResponse({ status: 429, description: 'Zbyt wiele prób logowania. Spróbuj później.' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    setSessionCookie(res, result.token);
    return result;
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Logowanie za pomocą Google' })
  @ApiResponse({ status: 200, description: 'Zalogowano przez Google pomyślnie' })
  @ApiResponse({ status: 401, description: 'Nieprawidłowy token Google' })
  async googleLogin(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.googleLogin(dto);
    setSessionCookie(res, result.token);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wylogowanie – usuwa cookie sesji' })
  async logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
    return { ok: true };
  }

  @Post('session')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ping sesji – zwraca id zalogowanego użytkownika (do bootstrapu SPA)' })
  async session(@Req() req: Request) {
    return { userId: (req as any).user.userId, email: (req as any).user.email };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change own password (needs the current one); other sessions are logged out, this one gets a fresh cookie',
  })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
    setSessionCookie(res, result.token);
    return result;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Żądanie resetu hasła (wysyła e-mail z linkiem)' })
  @ApiResponse({ status: 200, description: 'Jeśli email istnieje, wysłano link resetujący' })
  @ApiResponse({ status: 429, description: 'Zbyt wiele prób. Spróbuj później.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Ustawienie nowego hasła na podstawie tokenu z e-maila' })
  @ApiResponse({ status: 200, description: 'Hasło zmienione' })
  @ApiResponse({ status: 400, description: 'Token nieprawidłowy lub wygasł' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
