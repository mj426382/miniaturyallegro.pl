import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import {
  ADJUST_LIMITS,
  BADGE_COLORS,
  BADGE_POSITIONS,
  EXPORT_FORMATS,
  EXPORT_RATIOS,
  EXPORT_ROTATIONS,
  MAX_BADGE_TEXT,
  MAX_EXPORT_SIZE,
  MIN_CROP_FRACTION,
  MIN_EXPORT_SIZE,
} from './export.service';

/** Reasons offered in the UI when a user rejects a graphic – used to tune prompts. */
export const FEEDBACK_REASONS = [
  'product-changed', // produkt wygląda inaczej niż w oryginale
  'artifacts', // błędy / artefakty
  'wrong-style', // nie pasuje do wybranego stylu
  'composition', // zła kompozycja / kadr
  'text-or-logo', // dodany tekst, logo, znak wodny
  'other',
] as const;

export class FeedbackDto {
  @ApiProperty({ enum: [1, -1], description: '1 = kciuk w górę, -1 = kciuk w dół' })
  @IsInt()
  @IsIn([1, -1], { message: 'Ocena musi być 1 albo -1' })
  rating: 1 | -1;

  @ApiProperty({ required: false, enum: FEEDBACK_REASONS })
  @IsOptional()
  @IsIn(FEEDBACK_REASONS as unknown as string[], { message: 'Nieznany powód' })
  reason?: string;

  @ApiProperty({ required: false, description: 'Opcjonalny komentarz' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  comment?: string;
}

/** Fractions (0–1) of the source image: which part of the graphic fills the exported canvas. */
export class CropDto {
  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  left: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  top: number;

  @ApiProperty({ minimum: MIN_CROP_FRACTION, maximum: 1 })
  @IsNumber()
  @Min(MIN_CROP_FRACTION)
  @Max(1)
  width: number;

  @ApiProperty({ minimum: MIN_CROP_FRACTION, maximum: 1 })
  @IsNumber()
  @Min(MIN_CROP_FRACTION)
  @Max(1)
  height: number;
}

/** Tone corrections (1 = unchanged) – the same values drive the CSS preview in the app. */
export class AdjustDto {
  @ApiProperty({
    required: false,
    minimum: ADJUST_LIMITS.brightness.min,
    maximum: ADJUST_LIMITS.brightness.max,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(ADJUST_LIMITS.brightness.min)
  @Max(ADJUST_LIMITS.brightness.max)
  brightness?: number;

  @ApiProperty({
    required: false,
    minimum: ADJUST_LIMITS.contrast.min,
    maximum: ADJUST_LIMITS.contrast.max,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(ADJUST_LIMITS.contrast.min)
  @Max(ADJUST_LIMITS.contrast.max)
  contrast?: number;

  @ApiProperty({
    required: false,
    minimum: ADJUST_LIMITS.saturation.min,
    maximum: ADJUST_LIMITS.saturation.max,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(ADJUST_LIMITS.saturation.min)
  @Max(ADJUST_LIMITS.saturation.max)
  saturation?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  sharpen?: boolean;
}

export class ExportDto {
  @ApiProperty({ required: false, enum: Object.keys(EXPORT_RATIOS), default: '1:1' })
  @IsOptional()
  @IsIn(Object.keys(EXPORT_RATIOS))
  ratio?: keyof typeof EXPORT_RATIOS;

  @ApiProperty({
    required: false,
    enum: EXPORT_ROTATIONS,
    default: 0,
    description: 'Obrót zgodnie z ruchem wskazówek zegara',
  })
  @IsOptional()
  @IsIn(EXPORT_ROTATIONS as unknown as number[])
  rotate?: (typeof EXPORT_ROTATIONS)[number];

  @ApiProperty({ required: false, type: AdjustDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdjustDto)
  adjust?: AdjustDto;

  @ApiProperty({
    required: false,
    type: CropDto,
    description: 'Kadr wybrany przez użytkownika; bez niego grafika jest dopasowana w całości (białe pasy)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CropDto)
  crop?: CropDto;

  @ApiProperty({
    required: false,
    description: `Dłuższy bok w px (${MIN_EXPORT_SIZE}–${MAX_EXPORT_SIZE})`,
    default: 1600,
  })
  @IsOptional()
  @IsNumber()
  @Min(MIN_EXPORT_SIZE)
  @Max(MAX_EXPORT_SIZE)
  size?: number;

  @ApiProperty({ required: false, enum: EXPORT_FORMATS, default: 'jpeg' })
  @IsOptional()
  @IsIn(EXPORT_FORMATS as unknown as string[])
  format?: (typeof EXPORT_FORMATS)[number];

  @ApiProperty({ required: false, description: 'Tekst plakietki, np. "-20%" lub "NOWOŚĆ"' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BADGE_TEXT)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  badgeText?: string;

  @ApiProperty({ required: false, enum: Object.keys(BADGE_COLORS) })
  @IsOptional()
  @IsIn(Object.keys(BADGE_COLORS))
  badgeColor?: keyof typeof BADGE_COLORS;

  @ApiProperty({ required: false, enum: BADGE_POSITIONS })
  @IsOptional()
  @IsIn(BADGE_POSITIONS as unknown as string[])
  badgePosition?: (typeof BADGE_POSITIONS)[number];
}
