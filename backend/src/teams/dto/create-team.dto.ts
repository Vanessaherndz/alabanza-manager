import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator'

// Un integrante del grupo con el instrumento que toca en él.
export class TeamMemberInputDto {
  @IsString()
  uid!: string

  @IsOptional()
  @IsString()
  instrument?: string
}

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TeamMemberInputDto)
  members?: TeamMemberInputDto[]
}
