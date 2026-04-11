import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Podaj prawidłowy adres email' })
  @IsNotEmpty({ message: 'Email jest wymagany' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString({ message: 'Hasło musi być tekstem' })
  @IsNotEmpty({ message: 'Hasło jest wymagane' })
  @MinLength(8, { message: 'Hasło musi mieć co najmniej 8 znaków' })
  @MaxLength(64, { message: 'Hasło może mieć maksymalnie 64 znaki' })
  @Matches(/[A-Z]/, {
    message: 'Hasło musi zawierać co najmniej jedną wielką literę',
  })
  @Matches(/[a-z]/, {
    message: 'Hasło musi zawierać co najmniej jedną małą literę',
  })
  @Matches(/\d/, {
    message: 'Hasło musi zawierać co najmniej jedną cyfrę',
  })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
    message: 'Hasło musi zawierać co najmniej jeden znak specjalny (!@#$%^&*...)',
  })
  password: string;

  @ApiProperty({ example: 'Jan Kowalski', required: false })
  @IsOptional()
  @IsString({ message: 'Imię musi być tekstem' })
  @MaxLength(100, { message: 'Imię może mieć maksymalnie 100 znaków' })
  @Transform(({ value }) => value?.trim())
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Podaj prawidłowy adres email' })
  @IsNotEmpty({ message: 'Email jest wymagany' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString({ message: 'Hasło musi być tekstem' })
  @IsNotEmpty({ message: 'Hasło jest wymagane' })
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Podaj prawidłowy adres email' })
  @IsNotEmpty({ message: 'Email jest wymagany' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;
}

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google ID token from the frontend',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE4MmU0M...'
  })
  @IsString({ message: 'Token Google musi być tekstem' })
  @IsNotEmpty({ message: 'Token Google jest wymagany' })
  googleToken: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Token jest wymagany' })
  token: string;

  @ApiProperty()
  @IsString({ message: 'Hasło musi być tekstem' })
  @IsNotEmpty({ message: 'Hasło jest wymagane' })
  @MinLength(8, { message: 'Hasło musi mieć co najmniej 8 znaków' })
  @MaxLength(64, { message: 'Hasło może mieć maksymalnie 64 znaki' })
  @Matches(/[A-Z]/, {
    message: 'Hasło musi zawierać co najmniej jedną wielką literę',
  })
  @Matches(/[a-z]/, {
    message: 'Hasło musi zawierać co najmniej jedną małą literę',
  })
  @Matches(/\d/, {
    message: 'Hasło musi zawierać co najmniej jedną cyfrę',
  })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
    message: 'Hasło musi zawierać co najmniej jeden znak specjalny (!@#$%^&*...)',
  })
  password: string;
}
