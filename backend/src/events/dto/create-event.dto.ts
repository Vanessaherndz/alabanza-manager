import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class EventSongInputDto {
  @IsString()
  songId!: string

  @IsOptional()
  @IsString()
  section?: string

  @IsOptional()
  @IsString()
  songKey?: string
}

export class EventAssignmentInputDto {
  @IsString()
  uid!: string

  @IsString()
  role!: string

  @IsOptional()
  @IsString()
  section?: string
}

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  title!: string

  @IsISO8601()
  startsAt!: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => EventSongInputDto)
  songs?: EventSongInputDto[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => EventAssignmentInputDto)
  assignments?: EventAssignmentInputDto[]
}
