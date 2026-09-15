import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RequestUser } from '../common/interfaces/authenticated-request'
import { ChurchAccessService } from '../common/church-access.service'
import { EventsService } from './events.service'
import { CreateEventDto } from './dto/create-event.dto'
import { AddSetlistSongDto } from './dto/add-setlist-song.dto'
import { UpdateSetlistSongDto } from './dto/update-setlist-song.dto'
import { AddAssignmentDto } from './dto/add-assignment.dto'
import { UpdateAssignmentDto } from './dto/update-assignment.dto'

@Controller()
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly access: ChurchAccessService,
  ) {}

  @Get('churches/:churchId/events')
  async list(
    @CurrentUser() user: RequestUser,
    @Param('churchId') churchId: string,
    @Query('upcoming') upcoming?: string,
  ) {
    await this.access.assertMember(user.uid, churchId)
    return this.events.listForChurchWithDetails(churchId, { upcoming: upcoming === 'true' })
  }

  @Post('churches/:churchId/events')
  async create(
    @CurrentUser() user: RequestUser,
    @Param('churchId') churchId: string,
    @Body() dto: CreateEventDto,
  ) {
    await this.access.assertAdmin(user.uid, churchId)
    return this.events.create(churchId, user.uid, dto)
  }

  @Get('events/:id')
  async getOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const churchId = await this.events.getChurchId(id)
    if (!churchId) throw new NotFoundException('Servicio no encontrado')
    await this.access.assertMember(user.uid, churchId)
    return this.events.getDetail(id)
  }

  @Delete('events/:id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const churchId = await this.events.getChurchId(id)
    if (!churchId) throw new NotFoundException('Servicio no encontrado')
    await this.access.assertAdmin(user.uid, churchId)
    await this.events.remove(id)
    return { ok: true }
  }

  @Post('events/:id/songs')
  async addSong(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AddSetlistSongDto,
  ) {
    const churchId = await this.events.getChurchId(id)
    if (!churchId) throw new NotFoundException('Servicio no encontrado')
    await this.access.assertAdmin(user.uid, churchId)
    return this.events.addSong(id, dto)
  }

  @Patch('events/:id/songs/:rowId')
  async updateSong(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body() dto: UpdateSetlistSongDto,
  ) {
    const churchId = await this.events.getChurchId(id)
    if (!churchId) throw new NotFoundException('Servicio no encontrado')
    await this.access.assertAdmin(user.uid, churchId)
    await this.events.updateSong(id, rowId, dto)
    return { ok: true }
  }

  @Delete('events/:id/songs/:rowId')
  async removeSong(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('rowId') rowId: string,
  ) {
    const churchId = await this.events.getChurchId(id)
    if (!churchId) throw new NotFoundException('Servicio no encontrado')
    await this.access.assertAdmin(user.uid, churchId)
    await this.events.removeSong(id, rowId)
    return { ok: true }
  }

  @Post('events/:id/assignments')
  async addAssignment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AddAssignmentDto,
  ) {
    const churchId = await this.events.getChurchId(id)
    if (!churchId) throw new NotFoundException('Servicio no encontrado')
    await this.access.assertAdmin(user.uid, churchId)
    return this.events.addAssignment(id, dto)
  }

  @Patch('events/:id/assignments/:rowId')
  async updateAssignment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    const churchId = await this.events.getChurchId(id)
    if (!churchId) throw new NotFoundException('Servicio no encontrado')
    const role = await this.access.assertMember(user.uid, churchId)
    const assignment = await this.events.getAssignment(id, rowId)

    // El admin gestiona cualquier asignacion; un usuario base solo puede
    // responder (confirmar/rechazar) la suya.
    if (role !== 'admin' && assignment.uid !== user.uid) {
      throw new ForbiddenException('No puedes modificar esta asignacion')
    }

    await this.events.updateAssignmentStatus(id, rowId, dto.status)
    return { ok: true }
  }

  @Delete('events/:id/assignments/:rowId')
  async removeAssignment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('rowId') rowId: string,
  ) {
    const churchId = await this.events.getChurchId(id)
    if (!churchId) throw new NotFoundException('Servicio no encontrado')
    await this.access.assertAdmin(user.uid, churchId)
    await this.events.removeAssignment(id, rowId)
    return { ok: true }
  }
}
