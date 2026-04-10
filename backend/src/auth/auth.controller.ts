import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ForgotPasswordDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Rejestracja nowego użytkownika' })
  @ApiResponse({ status: 201, description: 'Użytkownik zarejestrowany pomyślnie' })
  @ApiResponse({ status: 400, description: 'Nieprawidłowe dane wejściowe' })
  @ApiResponse({ status: 409, description: 'Email już jest w użyciu' })
  @ApiResponse({ status: 429, description: 'Zbyt wiele prób rejestracji. Spróbuj później.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Logowanie za pomocą email i hasła' })
  @ApiResponse({ status: 200, description: 'Zalogowano pomyślnie' })
  @ApiResponse({ status: 401, description: 'Nieprawidłowy email lub hasło' })
  @ApiResponse({ status: 429, description: 'Zbyt wiele prób logowania. Spróbuj później.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Żądanie resetu hasła' })
  @ApiResponse({ status: 200, description: 'Jeśli email istnieje, wysłano link resetujący' })
  @ApiResponse({ status: 429, description: 'Zbyt wiele prób. Spróbuj później.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }
}
