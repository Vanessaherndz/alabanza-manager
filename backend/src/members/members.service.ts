import { Injectable, NotFoundException } from '@nestjs/common'
import { ChurchAccessService } from '../common/church-access.service'
import { ProfilesService } from '../common/profiles.service'
import { normalizeUsername } from '../common/username.util'
import { CreateMemberDto } from './dto/create-member.dto'
import { LinkMemberDto } from './dto/link-member.dto'

export interface MemberDto {
  uid: string
  username: string | null
  fullName: string
  instrument: string | null
  role: 'admin' | 'user'
}

@Injectable()
export class MembersService {
  constructor(
    private readonly access: ChurchAccessService,
    private readonly profiles: ProfilesService,
  ) {}

  async list(churchId: string): Promise<MemberDto[]> {
    const memberships = await this.access.listMembers(churchId)
    const profiles = await this.profiles.getProfiles(memberships.map((m) => m.uid))
    return memberships.map((m) => {
      const profile = profiles.get(m.uid)
      return {
        uid: m.uid,
        username: profile?.username ?? null,
        fullName: profile?.fullName ?? '',
        instrument: profile?.instrument ?? null,
        role: m.role,
      }
    })
  }

  // Da de alta un miembro "de repertorio": solo nombre + instrumento, sin
  // cuenta ni contrasena. Sirve para poder asignarlo a los servicios.
  async create(churchId: string, dto: CreateMemberDto): Promise<MemberDto> {
    const uid = await this.profiles.createRosterProfile({
      fullName: dto.fullName,
      instrument: dto.instrument?.trim() || null,
    })
    await this.access.setMembership(churchId, uid, 'user')

    return {
      uid,
      username: null,
      fullName: dto.fullName,
      instrument: dto.instrument?.trim() || null,
      role: 'user',
    }
  }

  // Agrega una cuenta ya existente (por username) a la iglesia.
  async link(churchId: string, dto: LinkMemberDto): Promise<MemberDto> {
    const uid = await this.profiles.findUidByUsername(dto.username)
    if (!uid) {
      throw new NotFoundException(`No existe un usuario con el nombre "${dto.username}"`)
    }
    await this.access.setMembership(churchId, uid, dto.role)
    const profile = await this.profiles.getProfile(uid)
    return {
      uid,
      username: profile?.username ?? normalizeUsername(dto.username),
      fullName: profile?.fullName ?? '',
      instrument: profile?.instrument ?? null,
      role: dto.role,
    }
  }

  async updateRole(churchId: string, uid: string, role: 'admin' | 'user'): Promise<void> {
    await this.access.setMembership(churchId, uid, role)
  }

  async remove(churchId: string, uid: string): Promise<void> {
    await this.access.removeMembership(churchId, uid)
  }
}
