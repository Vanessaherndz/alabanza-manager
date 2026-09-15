import { IsIn } from 'class-validator'

export class UpdateAssignmentDto {
  @IsIn(['invitado', 'confirmado', 'rechazado'])
  status!: 'invitado' | 'confirmado' | 'rechazado'
}
