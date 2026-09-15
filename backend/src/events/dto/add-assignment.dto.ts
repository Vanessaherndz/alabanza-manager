import { IsOptional, IsString } from 'class-validator'

export class AddAssignmentDto {
  @IsString()
  uid!: string

  @IsOptional()
  @IsString()
  role?: string

  @IsOptional()
  @IsString()
  section?: string
}
