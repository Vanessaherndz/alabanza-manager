import { IsIn, IsOptional, IsString, IsUrl, MinLength } from 'class-validator'
import { SONG_CATEGORIES } from './song-categories'

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

  @IsOptional()
  @IsIn(SONG_CATEGORIES)
  category?: string
}
