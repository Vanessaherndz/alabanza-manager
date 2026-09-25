import { ArrayMinSize, IsArray, IsString } from 'class-validator'

export class UpdateSongCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categories!: string[]
}
