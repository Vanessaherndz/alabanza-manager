import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RequestUser } from '../common/interfaces/authenticated-request'
import { ChurchAccessService } from '../common/church-access.service'
import { SongsService } from './songs.service'
import { CreateSongDto } from './dto/create-song.dto'
import { UpdateSongDto } from './dto/update-song.dto'

@Controller()
export class SongsController {
  constructor(
    private readonly songs: SongsService,
    private readonly access: ChurchAccessService,
  ) {}

  @Get('churches/:churchId/songs')
  async list(@CurrentUser() user: RequestUser, @Param('churchId') churchId: string) {
    await this.access.assertMember(user.uid, churchId)
    return this.songs.list(churchId)
  }

  @Post('churches/:churchId/songs')
  async create(
    @CurrentUser() user: RequestUser,
    @Param('churchId') churchId: string,
    @Body() dto: CreateSongDto,
  ) {
    await this.access.assertAdmin(user.uid, churchId)
    return this.songs.create(churchId, user.uid, dto)
  }

  @Patch('songs/:id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateSongDto,
  ) {
    const churchId = await this.songs.getChurchId(id)
    if (!churchId) throw new NotFoundException('Cancion no encontrada')
    await this.access.assertAdmin(user.uid, churchId)
    return this.songs.update(id, dto)
  }

  @Delete('songs/:id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const churchId = await this.songs.getChurchId(id)
    if (!churchId) throw new NotFoundException('Cancion no encontrada')
    await this.access.assertAdmin(user.uid, churchId)
    await this.songs.remove(id)
    return { ok: true }
  }
}
