import { IsIn, IsString } from 'class-validator'

export class LinkMemberDto {
  @IsString()
  username!: string

  @IsIn(['admin', 'user'])
  role!: 'admin' | 'user'
}
