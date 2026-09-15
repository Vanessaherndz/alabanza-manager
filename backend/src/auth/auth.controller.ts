import { Controller, Get, NotFoundException } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RequestUser } from '../common/interfaces/authenticated-request'
import { ProfilesService } from '../common/profiles.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    const profile = await this.profiles.getProfile(user.uid)
    if (!profile) {
      throw new NotFoundException(
        'No existe un perfil para esta cuenta. Pide a un administrador que la registre.',
      )
    }
    return profile
  }
}
