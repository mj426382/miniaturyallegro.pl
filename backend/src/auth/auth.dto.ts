import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsNotEmpty,
  IsBoolean,
  Equals,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

/** Reusable password rules – applied to registration and password reset. */
export function PasswordRules(): PropertyDecorator {
  const decorators = [
    IsString({ message: 'Hasło musi być tekstem' }),
    IsNotEmpty({ message: 'Hasło jest wymagane' }),
    MinLength(8, { message: 'Hasło musi mieć co najmniej 8 znaków' }),
    MaxLength(64, { message: 'Hasło może mieć maksymalnie 64 znaki' }),
    Matches(/[A-Z]/, { message: 'Hasło musi zawierać co najmniej jedną wielką literę' }),
    Matches(/[a-z]/, { message: 'Hasło musi zawierać co najmniej jedną małą literę' }),
    Matches(/\d/, { message: 'Hasło musi zawierać co najmniej jedną cyfrę' }),
    Matches(SPECIAL_CHARS, {
      message: 'Hasło musi zawierać co najmniej jeden znak specjalny (!@#$%^&*...)',
    }),
  ];
  return (target: object, propertyKey: string | symbol) => {
    for (const d of decorators) d(target, propertyKey);
  };
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Podaj prawidłowy adres email' })
  @IsNotEmpty({ message: 'Email jest wymagany' })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @PasswordRules()
  password: string;

  @ApiProperty({ example: 'Jan Kowalski', required: false })
  @IsOptional()
  @IsString({ message: 'Imię musi być tekstem' })
  @MaxLength(100, { message: 'Imię może mieć maksymalnie 100 znaków' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiProperty({ example: true, description: 'Akceptacja regulaminu i polityki prywatności' })
  @IsBoolean({ message: 'Akceptacja regulaminu jest wymagana' })
  @Equals(true, { message: 'Aby założyć konto, musisz zaakceptować regulamin' })
  acceptedTerms: boolean;

  @ApiProperty({ required: false, description: 'Spec 16: opt-in to tips and reminders by e-mail (never preselected)' })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiProperty({
    required: false,
    description: 'Spec 20: referral code from the link /register?ref=<code> (unknown codes are ignored)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;
}

/** Password change from the account settings – the current password proves possession of the account. */
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Podaj obecne hasło' })
  currentPassword: string;

  @ApiProperty({ example: 'NewStrongPassword123!' })
  @PasswordRules()
  newPassword: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Podaj prawidłowy adres email' })
  @IsNotEmpty({ message: 'Email jest wymagany' })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString({ message: 'Hasło musi być tekstem' })
  @IsNotEmpty({ message: 'Hasło jest wymagane' })
  @MaxLength(64)
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Podaj prawidłowy adres email' })
  @IsNotEmpty({ message: 'Email jest wymagany' })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;
}

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google ID token from the frontend',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE4MmU0M...',
  })
  @IsString({ message: 'Token Google musi być tekstem' })
  @IsNotEmpty({ message: 'Token Google jest wymagany' })
  @MaxLength(4096)
  googleToken: string;

  @ApiProperty({ required: false, description: 'Akceptacja regulaminu (wymagana tylko dla nowych kont)' })
  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;

  @ApiProperty({
    required: false,
    description: 'Spec 20: referral code from the link /register?ref=<code> (unknown codes are ignored)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token from the verification link' })
  @IsString()
  @IsNotEmpty({ message: 'Token jest wymagany' })
  @MaxLength(256)
  token: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Token jest wymagany' })
  @MaxLength(256)
  token: string;

  @ApiProperty()
  @PasswordRules()
  password: string;
}
