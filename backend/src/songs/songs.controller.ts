import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RequestUser } from '../common/interfaces/authenticated-request'
import { ChurchAccessService } from '../common/church-access.service'
import { SongsService } from './songs.service'
import { CreateSongDto } from './dto/create-song.dto'
import { UpdateSongDto } from './dto/update-song.dto'
import { UpdateSongCategoriesDto } from './dto/update-song-categories.dto'

@Controller()
export class SongsController {
  constructor(
    private readonly songs: SongsService,
    private readonly access: ChurchAccessService,
  ) {}

  @Get('song-categories')
  async getCategories(@CurrentUser() user: RequestUser) {
    await this.access.assertAnyChurchMember(user.uid)
    return this.songs.getCategories()
  }

  @Patch('song-categories')
  async updateCategories(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateSongCategoriesDto,
  ) {
    await this.access.assertAnyChurchAdmin(user.uid)
    return this.songs.updateCategories(dto.categories)
  }

  @Get('songs')
  async list(@CurrentUser() user: RequestUser) {
    await this.access.assertAnyChurchMember(user.uid)
    return this.songs.list()
  }

  @Post('songs')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateSongDto) {
    await this.access.assertAnyChurchAdmin(user.uid)
    return this.songs.create(user.uid, dto)
  }

  @Patch('songs/:id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateSongDto,
  ) {
    await this.access.assertAnyChurchAdmin(user.uid)
    return this.songs.update(id, dto)
  }

  @Delete('songs/:id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.access.assertAnyChurchAdmin(user.uid)
    await this.songs.remove(id)
    return { ok: true }
  }
}
