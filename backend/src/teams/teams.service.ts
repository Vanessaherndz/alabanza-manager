import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { ChurchAccessService } from '../common/church-access.service'
import { CreateTeamDto, TeamMemberInputDto } from './dto/create-team.dto'
import { UpdateTeamDto } from './dto/update-team.dto'

interface TeamMember {
  uid: string
  instrument: string | null
}

function toDto(id: string, data: admin.firestore.DocumentData) {
  return {
    id,
    name: data.name as string,
    description: (data.description as string | null) ?? null,
    members: ((data.members as TeamMember[] | undefined) ?? []).map((m) => ({
      uid: m.uid,
      instrument: m.instrument ?? null,
    })),
  }
}

// Grupos de músicos de una iglesia (p. ej. "Banda A"): se usan para llenar
// de una vez los músicos de una sección al crear un servicio.
@Injectable()
export class TeamsService {
  constructor(
    @Inject(FIRESTORE) private readonly db: admin.firestore.Firestore,
    private readonly access: ChurchAccessService,
  ) {}

  private collection() {
    return this.db.collection('teams')
  }

  // Quita repetidos y valida que todos sean miembros de la iglesia.
  private async sanitizeMembers(
    churchId: string,
    members: TeamMemberInputDto[] = [],
  ): Promise<TeamMember[]> {
    const churchUids = new Set((await this.access.listMembers(churchId)).map((m) => m.uid))
    const seen = new Set<string>()
    const result: TeamMember[] = []
    for (const m of members) {
      if (seen.has(m.uid)) continue
      if (!churchUids.has(m.uid)) {
        throw new BadRequestException('Uno de los integrantes no es miembro de la iglesia.')
      }
      seen.add(m.uid)
      result.push({ uid: m.uid, instrument: m.instrument?.trim() || null })
    }
    return result
  }

  private async getOwned(churchId: string, id: string) {
    const ref = this.collection().doc(id)
    const snap = await ref.get()
    if (!snap.exists || snap.data()!.churchId !== churchId) {
      throw new NotFoundException('Grupo no encontrado')
    }
    return ref
  }

  async list(churchId: string) {
    const snap = await this.collection().where('churchId', '==', churchId).orderBy('name').get()
    return snap.docs.map((d) => toDto(d.id, d.data()))
  }

  async create(churchId: string, dto: CreateTeamDto) {
    const ref = this.collection().doc()
    const data = {
      churchId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      members: await this.sanitizeMembers(churchId, dto.members),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    await ref.set(data)
    return toDto(ref.id, data)
  }

  async update(churchId: string, id: string, dto: UpdateTeamDto) {
    const ref = await this.getOwned(churchId, id)
    const changes: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    if (dto.name !== undefined) changes.name = dto.name.trim()
    if (dto.description !== undefined) changes.description = dto.description.trim() || null
    if (dto.members !== undefined) changes.members = await this.sanitizeMembers(churchId, dto.members)
    await ref.update(changes)
    return toDto(id, (await ref.get()).data()!)
  }

  async remove(churchId: string, id: string) {
    const ref = await this.getOwned(churchId, id)
    await ref.delete()
  }
}
