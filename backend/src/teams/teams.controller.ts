import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RequestUser } from '../common/interfaces/authenticated-request'
import { ChurchAccessService } from '../common/church-access.service'
import { TeamsService } from './teams.service'
import { CreateTeamDto } from './dto/create-team.dto'

@Controller('churches/:churchId/teams')
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly access: ChurchAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Param('churchId') churchId: string) {
    await this.access.assertMember(user.uid, churchId)
    return this.teams.list(churchId)
  }

  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Param('churchId') churchId: string,
    @Body() dto: CreateTeamDto,
  ) {
    await this.access.assertAdmin(user.uid, churchId)
    return this.teams.create(churchId, dto)
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: RequestUser,
    @Param('churchId') churchId: string,
    @Param('id') id: string,
  ) {
    await this.access.assertAdmin(user.uid, churchId)
    await this.teams.remove(id)
    return { ok: true }
  }
}
