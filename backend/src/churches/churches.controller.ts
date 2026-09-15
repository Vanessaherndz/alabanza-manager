import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RequestUser } from '../common/interfaces/authenticated-request'
import { ChurchAccessService } from '../common/church-access.service'
import { ChurchesService } from './churches.service'
import { CreateChurchDto } from './dto/create-church.dto'

@Controller('churches')
export class ChurchesController {
  constructor(
    private readonly churches: ChurchesService,
    private readonly access: ChurchAccessService,
  ) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateChurchDto) {
    return this.churches.create(user.uid, dto)
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.churches.listForUser(user.uid)
  }

  @Get(':id')
  async getOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.access.assertMember(user.uid, id)
    const church = await this.churches.getById(id)
    if (!church) throw new NotFoundException('Iglesia no encontrada')
    return church
  }
}
