import { IsIn } from 'class-validator'

export class UpdateMemberRoleDto {
  @IsIn(['admin', 'user'])
  role!: 'admin' | 'user'
}
