import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const DEMO_STYLE_IDS = ['white-bg', 'lifestyle-home', 'dark-luxury'] as const;

/** Multipart form – every field arrives as a string. */
export class CreateDemoDto {
  @ApiProperty({ example: 'sprzedawca@example.com' })
  @IsEmail({}, { message: 'Podaj prawidłowy adres email' })
  @IsNotEmpty({ message: 'Email jest wymagany' })
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ enum: DEMO_STYLE_IDS, default: 'white-bg' })
  @IsOptional()
  @IsIn(DEMO_STYLE_IDS as unknown as string[], { message: 'Nieznany styl' })
  style?: (typeof DEMO_STYLE_IDS)[number];

  @ApiProperty({ required: false, description: 'Zgoda na wiadomości marketingowe (opcjonalna)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  marketingOk?: boolean;

  /** Honeypot – bots fill every field; humans never see this one. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
