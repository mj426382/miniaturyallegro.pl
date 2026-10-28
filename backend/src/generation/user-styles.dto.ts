import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_USER_PROMPT_LENGTH } from './generation.dto';

/** Spec 27: limits of a saved user style. */
export const USER_STYLE_NAME_MIN = 2;
export const USER_STYLE_NAME_MAX = 60;
export const USER_STYLE_PROMPT_MIN = 3;
export const MAX_USER_STYLES = 20;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Multipart form – every field arrives as a string. */
export class CreateUserStyleDto {
  @ApiProperty({ description: 'Nazwa stylu (unikalna w koncie)', example: 'Kuchnia z kotem' })
  @IsString()
  @MinLength(USER_STYLE_NAME_MIN, { message: 'Nazwa stylu jest zbyt krótka' })
  @MaxLength(USER_STYLE_NAME_MAX, { message: `Nazwa stylu może mieć maksymalnie ${USER_STYLE_NAME_MAX} znaków` })
  @Transform(trim)
  name: string;

  @ApiProperty({
    description: 'Opis sceny po polsku',
    example: 'Produkt na drewnianym stole w jasnej kuchni, obok siedzi kot',
  })
  @IsString()
  @MinLength(USER_STYLE_PROMPT_MIN, { message: 'Opis jest zbyt krótki' })
  @MaxLength(MAX_USER_PROMPT_LENGTH, { message: `Opis może mieć maksymalnie ${MAX_USER_PROMPT_LENGTH} znaków` })
  @Transform(trim)
  prompt: string;
}

/** Multipart form – every field optional; `removeReference=true` deletes the reference photo. */
export class UpdateUserStyleDto {
  @ApiProperty({ required: false, description: 'Nowa nazwa stylu' })
  @IsOptional()
  @IsString()
  @MinLength(USER_STYLE_NAME_MIN, { message: 'Nazwa stylu jest zbyt krótka' })
  @MaxLength(USER_STYLE_NAME_MAX, { message: `Nazwa stylu może mieć maksymalnie ${USER_STYLE_NAME_MAX} znaków` })
  @Transform(trim)
  name?: string;

  @ApiProperty({ required: false, description: 'Nowy opis sceny' })
  @IsOptional()
  @IsString()
  @MinLength(USER_STYLE_PROMPT_MIN, { message: 'Opis jest zbyt krótki' })
  @MaxLength(MAX_USER_PROMPT_LENGTH, { message: `Opis może mieć maksymalnie ${MAX_USER_PROMPT_LENGTH} znaków` })
  @Transform(trim)
  prompt?: string;

  @ApiProperty({ required: false, description: 'true = usuń zdjęcie wzoru' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  removeReference?: boolean;
}
