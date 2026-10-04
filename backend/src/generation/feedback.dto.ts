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
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsPositive,
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
import {
  INFOGRAPHIC_ICON_IDS,
  INFOGRAPHIC_TEMPLATES,
  INFOGRAPHIC_THEMES,
  InfographicTemplate,
  InfographicTheme,
  LENGTH_UNITS,
  LengthUnit,
  MAX_DIMENSION,
  MAX_FEATURE_TEXT,
  MAX_FEATURES,
  MAX_TITLE,
  WEIGHT_UNITS,
  WeightUnit,
} from './infographic.service';
import { MAX_ZIP_IMAGES } from './zip.service';

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

// ─── Infographics (spec 14) ─────────────────────────────────────────

export class InfographicFeatureDto {
  @ApiProperty({ enum: INFOGRAPHIC_ICON_IDS })
  @IsIn(INFOGRAPHIC_ICON_IDS, { message: 'Nieznana ikona' })
  icon: string;

  @ApiProperty({ maxLength: MAX_FEATURE_TEXT })
  @IsString()
  @MaxLength(MAX_FEATURE_TEXT, { message: `Opis cechy może mieć maksymalnie ${MAX_FEATURE_TEXT} znaków` })
  text: string;
}

export class InfographicDimensionsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Szerokość musi być liczbą' })
  @IsPositive({ message: 'Szerokość musi być większa od zera' })
  @Max(MAX_DIMENSION)
  width?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Wysokość musi być liczbą' })
  @IsPositive({ message: 'Wysokość musi być większa od zera' })
  @Max(MAX_DIMENSION)
  height?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Głębokość musi być liczbą' })
  @IsPositive({ message: 'Głębokość musi być większa od zera' })
  @Max(MAX_DIMENSION)
  depth?: number;

  @ApiProperty({ enum: LENGTH_UNITS })
  @IsIn(LENGTH_UNITS, { message: 'Jednostka wymiarów to mm, cm albo m' })
  unit: LengthUnit;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Waga musi być liczbą' })
  @IsPositive({ message: 'Waga musi być większa od zera' })
  @Max(MAX_DIMENSION)
  weight?: number;

  @ApiProperty({ required: false, enum: WEIGHT_UNITS })
  @IsOptional()
  @IsIn(WEIGHT_UNITS, { message: 'Jednostka wagi to g albo kg' })
  weightUnit?: WeightUnit;
}

export class InfographicDto {
  @ApiProperty({ enum: INFOGRAPHIC_TEMPLATES })
  @IsIn(INFOGRAPHIC_TEMPLATES, { message: 'Nieznany szablon infografiki' })
  template: InfographicTemplate;

  @ApiProperty({ required: false, maxLength: MAX_TITLE })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TITLE, { message: `Tytuł może mieć maksymalnie ${MAX_TITLE} znaków` })
  title?: string;

  @ApiProperty({ required: false, type: [InfographicFeatureDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FEATURES, { message: `Dodaj od 1 do ${MAX_FEATURES} cech` })
  @ValidateNested({ each: true })
  @Type(() => InfographicFeatureDto)
  features?: InfographicFeatureDto[];

  @ApiProperty({ required: false, type: InfographicDimensionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InfographicDimensionsDto)
  dimensions?: InfographicDimensionsDto;

  @ApiProperty({ required: false, enum: INFOGRAPHIC_THEMES })
  @IsOptional()
  @IsIn(INFOGRAPHIC_THEMES)
  theme?: InfographicTheme;

  @ApiProperty({ required: false, enum: Object.keys(BADGE_COLORS) })
  @IsOptional()
  @IsIn(Object.keys(BADGE_COLORS))
  accent?: keyof typeof BADGE_COLORS;

  @ApiProperty({ required: false, enum: ['png', 'jpeg'] })
  @IsOptional()
  @IsIn(['png', 'jpeg'])
  format?: 'png' | 'jpeg';
}

// ─── ZIP (spec 15) ──────────────────────────────────────────────────

export class ZipDto {
  @ApiProperty({ type: [String], description: 'Photos to pack, in the order of the folders (max 50)' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Zaznacz co najmniej jedno zdjęcie' })
  @ArrayMaxSize(MAX_ZIP_IMAGES, { message: `Jedna paczka może zawierać maksymalnie ${MAX_ZIP_IMAGES} zdjęć` })
  @ArrayUnique({ message: 'Zdjęcia w paczce nie mogą się powtarzać' })
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  imageIds: string[];
}
