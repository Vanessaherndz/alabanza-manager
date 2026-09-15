import { Controller, Get, Param } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RequestUser } from '../common/interfaces/authenticated-request'
import { ChurchAccessService } from '../common/church-access.service'
import { DashboardService } from './dashboard.service'

@Controller('churches/:churchId')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly access: ChurchAccessService,
  ) {}

  @Get('dashboard')
  async summary(@CurrentUser() user: RequestUser, @Param('churchId') churchId: string) {
    await this.access.assertMember(user.uid, churchId)
    return this.dashboard.getSummary(churchId)
  }
}
