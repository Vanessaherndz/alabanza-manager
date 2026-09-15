import { IsOptional, IsString } from 'class-validator'

export class UpdateSetlistSongDto {
  @IsOptional()
  @IsString()
  section?: string
}
