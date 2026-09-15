import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RequestUser } from '../common/interfaces/authenticated-request'
import { ChurchAccessService } from '../common/church-access.service'
import { MembersService } from './members.service'
import { CreateMemberDto } from './dto/create-member.dto'
import { LinkMemberDto } from './dto/link-member.dto'
import { UpdateMemberRoleDto } from './dto/update-member-role.dto'

@Controller('churches/:churchId/members')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly access: ChurchAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Param('churchId') churchId: string) {
    await this.access.assertMember(user.uid, churchId)
    return this.members.list(churchId)
  }

  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Param('churchId') churchId: string,
    @Body() dto: CreateMemberDto,
  ) {
    await this.access.assertAdmin(user.uid, churchId)
    return this.members.create(churchId, dto)
  }

  @Post('link')
  async link(
    @CurrentUser() user: RequestUser,
    @Param('churchId') churchId: string,
    @Body() dto: LinkMemberDto,
  ) {
    await this.access.assertAdmin(user.uid, churchId)
    return this.members.link(churchId, dto)
  }

  @Patch(':uid')
  async updateRole(
    @CurrentUser() user: RequestUser,
    @Param('churchId') churchId: string,
    @Param('uid') targetUid: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    await this.access.assertAdmin(user.uid, churchId)
    await this.members.updateRole(churchId, targetUid, dto.role)
    return { ok: true }
  }

  @Delete(':uid')
  async remove(
    @CurrentUser() user: RequestUser,
    @Param('churchId') churchId: string,
    @Param('uid') targetUid: string,
  ) {
    await this.access.assertAdmin(user.uid, churchId)
    await this.members.remove(churchId, targetUid)
    return { ok: true }
  }
}
