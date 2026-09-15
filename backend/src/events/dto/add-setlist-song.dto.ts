import { IsOptional, IsString } from 'class-validator'

export class AddSetlistSongDto {
  @IsString()
  songId!: string

  @IsOptional()
  @IsString()
  section?: string

  @IsOptional()
  @IsString()
  songKey?: string
}
