import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { STYLE_IDS } from './styles';

export const MAX_BASE_PROMPT_LENGTH = 400;
export const MAX_USER_PROMPT_LENGTH = 500;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StartGenerationDto {
  @ApiProperty({
    required: false,
    description: 'Identyfikatory stylów do wygenerowania. Domyślnie zestaw startowy (3 style).',
    example: ['white-bg', 'lifestyle-home', 'dark-luxury'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Wybierz co najmniej jeden styl' })
  @ArrayMaxSize(STYLE_IDS.length)
  @ArrayUnique()
  @IsIn(STYLE_IDS, { each: true, message: 'Nieznany styl' })
  styles?: string[];

  @ApiProperty({ required: false, description: 'Dodatkowe wskazówki stosowane do wszystkich stylów' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BASE_PROMPT_LENGTH, { message: `Wskazówki mogą mieć maksymalnie ${MAX_BASE_PROMPT_LENGTH} znaków` })
  @Transform(trim)
  basePrompt?: string;
}

/** Multipart form – every field arrives as a string. */
export class CustomGenerationDto {
  @ApiProperty({ description: 'Opis stylu / sceny lub żądanej modyfikacji' })
  @IsString()
  @MinLength(3, { message: 'Opis jest zbyt krótki' })
  @MaxLength(MAX_USER_PROMPT_LENGTH, { message: `Opis może mieć maksymalnie ${MAX_USER_PROMPT_LENGTH} znaków` })
  @Transform(trim)
  userPrompt: string;

  @ApiProperty({ required: false, description: 'true = przeróbka wcześniej wygenerowanej grafiki' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isRework?: boolean;
}
