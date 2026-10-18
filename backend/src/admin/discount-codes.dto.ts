import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const DISCOUNT_TYPES = ['percent', 'amount'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/** Spec 16, AC-ADM-017: letters A–Z, digits and a dash, 3–30 characters (Stripe accepts the same set). */
export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9-]{3,30}$/;

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Spec 16, AC-ADM-017: a partner discount code (Stripe coupon `duration: once` + promotion code). */
export class CreateDiscountCodeDto {
  @ApiProperty({ example: 'PARTNER-10', description: 'A–Z, 0–9 and a dash, 3–30 characters; stored upper-case' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'Podaj kod rabatowy' })
  @Matches(DISCOUNT_CODE_PATTERN, {
    message: 'Kod może mieć 3–30 znaków: litery A–Z (bez polskich znaków), cyfry i myślnik',
  })
  code: string;

  @ApiProperty({ enum: DISCOUNT_TYPES, example: 'percent' })
  @IsIn(DISCOUNT_TYPES, { message: 'Wybierz rodzaj rabatu: procentowy albo kwotowy' })
  type: DiscountType;

  @ApiPropertyOptional({ example: 10, description: 'Required for type "percent": whole number 1–100' })
  @ValidateIf((o) => o.type === 'percent')
  @IsInt({ message: 'Rabat procentowy musi być liczbą całkowitą od 1 do 100' })
  @Min(1, { message: 'Rabat procentowy musi być liczbą całkowitą od 1 do 100' })
  @Max(100, { message: 'Rabat procentowy musi być liczbą całkowitą od 1 do 100' })
  percentOff?: number;

  @ApiPropertyOptional({ example: 5, description: 'Required for type "amount": złoty, > 0, at most 2 decimals' })
  @ValidateIf((o) => o.type === 'amount')
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'Kwota rabatu musi być liczbą w zł z najwyżej 2 miejscami po przecinku' },
  )
  @Min(0.01, { message: 'Kwota rabatu musi być większa od 0 zł' })
  @Max(10000, { message: 'Kwota rabatu może wynosić najwyżej 10 000 zł' })
  amountOffPln?: number;

  @ApiPropertyOptional({ example: 100, description: 'How many times the code can be used in total' })
  @IsOptional()
  @IsInt({ message: 'Limit użyć musi być liczbą całkowitą' })
  @Min(1, { message: 'Limit użyć musi wynosić co najmniej 1' })
  @Max(1000000, { message: 'Limit użyć może wynosić najwyżej 1 000 000' })
  maxRedemptions?: number;

  @ApiPropertyOptional({ example: '2026-12-31T22:59:59.000Z', description: 'ISO 8601, must be in the future' })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Nieprawidłowa data ważności' })
  expiresAt?: string;

  @ApiPropertyOptional({ example: 'Katalog firm – czytelnicy', description: 'For the operator, up to 200 characters' })
  @IsOptional()
  @Transform(trimmed)
  @IsString({ message: 'Notatka musi być tekstem' })
  @MaxLength(200, { message: 'Notatka może mieć maksymalnie 200 znaków' })
  note?: string;
}
