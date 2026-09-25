import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator'

export class CreateSongDto {
  @IsString()
  @MinLength(1)
  title!: string

  @IsOptional()
  @IsString()
  songKey?: string

  @IsOptional()
  @IsUrl()
  referenceUrl?: string

  // Validada contra la lista global de categorias (ver SongsService).
  @IsOptional()
  @IsString()
  category?: string
}
