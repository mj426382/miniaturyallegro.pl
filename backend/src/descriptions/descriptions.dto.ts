import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_BODY_LENGTH, MAX_KEYWORD_LENGTH, MAX_KEYWORDS, MAX_TITLE_LENGTH } from './allegro-html';

export const MAX_SELLER_NOTES_LENGTH = 2000;
export const MAX_INSTRUCTION_LENGTH = 600;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateDescriptionDto {
  @ApiProperty({
    required: false,
    description: 'Informacje od sprzedawcy: cechy, wymiary, materiał, zawartość zestawu, przewagi',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SELLER_NOTES_LENGTH)
  @Transform(trim)
  notes?: string;
}

export class UpdateDescriptionDto {
  @ApiProperty({ maxLength: MAX_TITLE_LENGTH, description: 'Tytuł oferty (limit Allegro: 75 znaków)' })
  @IsString()
  @MinLength(3, { message: 'Tytuł jest za krótki' })
  @MaxLength(MAX_TITLE_LENGTH, { message: `Tytuł może mieć maksymalnie ${MAX_TITLE_LENGTH} znaków` })
  @Transform(trim)
  title: string;

  @ApiProperty({ maxLength: MAX_BODY_LENGTH, description: 'Opis w HTML (dozwolone: h2, p, ul, ol, li, b)' })
  @IsString()
  @MinLength(20, { message: 'Opis jest za krótki' })
  @MaxLength(MAX_BODY_LENGTH)
  body: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_KEYWORDS)
  @IsString({ each: true })
  @MaxLength(MAX_KEYWORD_LENGTH, { each: true })
  keywords?: string[];
}

export class RefineDescriptionDto {
  @ApiProperty({ description: 'Co zmienić, np. "skróć o połowę i dodaj sekcję o gwarancji"' })
  @IsString()
  @MinLength(3, { message: 'Napisz, co zmienić w opisie' })
  @MaxLength(MAX_INSTRUCTION_LENGTH)
  @Transform(trim)
  instruction: string;
}
