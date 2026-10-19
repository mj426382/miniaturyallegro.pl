import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
} from 'class-validator';
import { DISCOUNT_CODE_PATTERN } from './discount-codes.dto';
import { isValidNip, normalizeNip, PARTNER_DEFAULTS, PARTNER_LIMITS } from '../partners/commission';

const CODE_MESSAGE = 'Kod może mieć 3–30 znaków: litery A–Z (bez polskich znaków), cyfry i myślnik';
const DISCOUNT_MESSAGE = 'Rabat dla klientów musi być liczbą całkowitą od 1 do 100';
const COMMISSION_MESSAGE = 'Prowizja musi być liczbą całkowitą od 1 do 50';
const MONTHS_MESSAGE = 'Okres prowizji musi być liczbą całkowitą od 1 do 60 miesięcy';
const NIP_MESSAGE = 'NIP musi mieć 10 cyfr z poprawną cyfrą kontrolną';

/** Trimmed text; an empty optional field means "none" (and clears the field when editing). */
const optionalText = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
const upperCode = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

/** Spec 24, AC-PRT-002: a Polish NIP with a valid check digit. */
function IsNip() {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isNip',
      target: object.constructor,
      propertyName,
      options: { message: NIP_MESSAGE },
      validator: { validate: (value: unknown) => typeof value === 'string' && isValidNip(value) },
    });
}

/** Spec 24, AC-PRT-001/002: a partner and – optionally – its first discount code in one step. */
export class CreatePartnerDto {
  @ApiProperty({ example: 'Katalog Firm Przykład', description: '2–100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Podaj nazwę partnera' })
  @MinLength(2, { message: 'Nazwa partnera musi mieć od 2 do 100 znaków' })
  @MaxLength(100, { message: 'Nazwa partnera musi mieć od 2 do 100 znaków' })
  name: string;

  @ApiProperty({ example: 'partner@example.com', description: 'Business contact; also the self-referral guard' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Podaj poprawny adres e-mail partnera' })
  @MaxLength(254, { message: 'Podaj poprawny adres e-mail partnera' })
  contactEmail: string;

  @ApiPropertyOptional({ example: 'Przykład sp. z o.o.', nullable: true })
  @IsOptional()
  @Transform(optionalText)
  @IsString({ message: 'Nazwa firmy musi być tekstem' })
  @MaxLength(200, { message: 'Nazwa firmy może mieć maksymalnie 200 znaków' })
  companyName?: string | null;

  @ApiPropertyOptional({ example: '526-000-12-46', description: 'Stored as 10 digits', nullable: true })
  @IsOptional()
  @Transform(({ value }) => {
    const text = optionalText({ value });
    return typeof text === 'string' ? normalizeNip(text) : text;
  })
  @IsNip()
  nip?: string | null;

  @ApiPropertyOptional({ example: PARTNER_DEFAULTS.customerDiscountPercent, description: 'Whole percent 1–100' })
  @IsOptional()
  @IsInt({ message: DISCOUNT_MESSAGE })
  @Min(PARTNER_LIMITS.discountPercent.min, { message: DISCOUNT_MESSAGE })
  @Max(PARTNER_LIMITS.discountPercent.max, { message: DISCOUNT_MESSAGE })
  customerDiscountPercent?: number;

  @ApiPropertyOptional({ example: PARTNER_DEFAULTS.commissionPercent, description: 'Whole percent 1–50' })
  @IsOptional()
  @IsInt({ message: COMMISSION_MESSAGE })
  @Min(PARTNER_LIMITS.commissionPercent.min, { message: COMMISSION_MESSAGE })
  @Max(PARTNER_LIMITS.commissionPercent.max, { message: COMMISSION_MESSAGE })
  commissionPercent?: number;

  @ApiPropertyOptional({ example: PARTNER_DEFAULTS.commissionMonths, description: 'Months 1–60 from attribution' })
  @IsOptional()
  @IsInt({ message: MONTHS_MESSAGE })
  @Min(PARTNER_LIMITS.commissionMonths.min, { message: MONTHS_MESSAGE })
  @Max(PARTNER_LIMITS.commissionMonths.max, { message: MONTHS_MESSAGE })
  commissionMonths?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'Pole „aktywny” musi mieć wartość tak albo nie' })
  active?: boolean;

  @ApiPropertyOptional({ example: 'Umowa z 19.10.2026', nullable: true })
  @IsOptional()
  @Transform(optionalText)
  @IsString({ message: 'Notatka musi być tekstem' })
  @MaxLength(500, { message: 'Notatka może mieć maksymalnie 500 znaków' })
  note?: string | null;

  @ApiPropertyOptional({ example: 'KATALOG-10', description: "Creates the partner's percent code (A–Z, 0–9, dash)" })
  @IsOptional()
  @Transform(upperCode)
  @IsString({ message: CODE_MESSAGE })
  @Matches(DISCOUNT_CODE_PATTERN, { message: CODE_MESSAGE })
  code?: string;

  @ApiPropertyOptional({ example: 500, description: 'Usage limit of the new code' })
  @IsOptional()
  @IsInt({ message: 'Limit użyć musi być liczbą całkowitą' })
  @Min(1, { message: 'Limit użyć musi wynosić co najmniej 1' })
  @Max(1000000, { message: 'Limit użyć może wynosić najwyżej 1 000 000' })
  codeMaxRedemptions?: number;

  @ApiPropertyOptional({ example: '2027-10-31T22:59:59.000Z', description: 'Expiry of the new code (future)' })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Nieprawidłowa data ważności' })
  codeExpiresAt?: string;
}

/** Spec 24, AC-PRT-003: every field optional; an empty company, NIP or note clears it. */
export class UpdatePartnerDto extends PartialType(
  OmitType(CreatePartnerDto, ['code', 'codeMaxRedemptions', 'codeExpiresAt'] as const),
) {}

/** Spec 24, AC-PRT-004: another code for the partner (percent = the partner's customer discount). */
export class CreatePartnerCodeDto {
  @ApiProperty({ example: 'KATALOG-2027' })
  @Transform(upperCode)
  @IsString({ message: CODE_MESSAGE })
  @Matches(DISCOUNT_CODE_PATTERN, { message: CODE_MESSAGE })
  code: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt({ message: 'Limit użyć musi być liczbą całkowitą' })
  @Min(1, { message: 'Limit użyć musi wynosić co najmniej 1' })
  @Max(1000000, { message: 'Limit użyć może wynosić najwyżej 1 000 000' })
  maxRedemptions?: number;

  @ApiPropertyOptional({ example: '2027-10-31T22:59:59.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Nieprawidłowa data ważności' })
  expiresAt?: string;
}

/** Spec 24, AC-PRT-004: links an existing code (e.g. SMARTNET20) to the partner. */
export class LinkPartnerCodeDto {
  @ApiProperty({ example: 'SMARTNET20' })
  @Transform(upperCode)
  @IsString({ message: CODE_MESSAGE })
  @Matches(DISCOUNT_CODE_PATTERN, { message: CODE_MESSAGE })
  code: string;
}

/** Spec 24, AC-PRT-012: a payout recorded by the administrator. */
export class CreatePartnerPayoutDto {
  @ApiProperty({ example: 120.5, description: 'Złoty, > 0, at most 2 decimals, up to 100 000 zł' })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'Kwota wypłaty musi być liczbą w zł z najwyżej 2 miejscami po przecinku' },
  )
  @Min(0.01, { message: 'Kwota wypłaty musi być większa od 0 zł' })
  @Max(PARTNER_LIMITS.maxPayoutGrosze / 100, { message: 'Kwota wypłaty może wynosić najwyżej 100 000 zł' })
  amountPln: number;

  @ApiProperty({ example: '2026-11-05', description: 'YYYY-MM-DD, not in the future (Polish time)' })
  @IsString({ message: 'Podaj datę wypłaty w formacie RRRR-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Podaj datę wypłaty w formacie RRRR-MM-DD' })
  paidOn: string;

  @ApiProperty({ example: 'FV 12/11/2026', description: "Partner's invoice number or a note, 1–200 characters" })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Podaj numer faktury partnera albo notatkę' })
  @MinLength(1, { message: 'Podaj numer faktury partnera albo notatkę' })
  @MaxLength(200, { message: 'Numer faktury lub notatka może mieć maksymalnie 200 znaków' })
  reference: string;
}
