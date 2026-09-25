import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { ChurchAccessService } from '../common/church-access.service'
import { ProfilesService } from '../common/profiles.service'
import { sanitizeList } from '../common/sanitize-list.util'
import { CreateChurchDto } from './dto/create-church.dto'
import { UpdateChurchSettingsDto } from './dto/update-church-settings.dto'
import { DEFAULT_INSTRUMENTS } from './defaults'

export interface ChurchSettings {
  instruments: string[]
}

export interface ChurchWithRole {
  id: string
  name: string
  city: string | null
  role: 'admin' | 'user'
  settings: ChurchSettings
}

function toSettings(data: admin.firestore.DocumentData | undefined): ChurchSettings {
  return {
    instruments: data?.settings?.instruments ?? DEFAULT_INSTRUMENTS,
  }
}

@Injectable()
export class ChurchesService {
  constructor(
    @Inject(FIRESTORE) private readonly db: admin.firestore.Firestore,
    private readonly access: ChurchAccessService,
    private readonly profiles: ProfilesService,
  ) {}

  private collection() {
    return this.db.collection('churches')
  }

  // Crea la iglesia y deja al creador como admin (equivalente a la RPC
  // create_church de la version en Supabase).
  async create(uid: string, dto: CreateChurchDto): Promise<ChurchWithRole> {
    const ref = this.collection().doc()
    const settings: ChurchSettings = { instruments: DEFAULT_INSTRUMENTS }
    await ref.set({
      name: dto.name,
      city: dto.city ?? null,
      settings,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    await this.access.setMembership(ref.id, uid, 'admin')
    return { id: ref.id, name: dto.name, city: dto.city ?? null, role: 'admin', settings }
  }

  async listForUser(uid: string): Promise<ChurchWithRole[]> {
    const isSystemAdmin = await this.profiles.isSystemAdmin(uid)

    if (isSystemAdmin) {
      const snap = await this.collection().orderBy('name').get()
      return snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        city: d.data().city ?? null,
        role: 'admin' as const,
        settings: toSettings(d.data()),
      }))
    }

    const churchIds = await this.access.listChurchIdsForUser(uid)
    if (churchIds.length === 0) return []

    const refs = churchIds.map((id) => this.collection().doc(id))
    const snaps = await this.db.getAll(...refs)
    const roles = new Map(
      (await Promise.all(churchIds.map((id) => this.access.getRole(uid, id)))).map(
        (role, i) => [churchIds[i], role],
      ),
    )

    return snaps
      .filter((s) => s.exists)
      .map((s) => ({
        id: s.id,
        name: s.data()!.name,
        city: s.data()!.city ?? null,
        role: (roles.get(s.id) ?? 'user') as 'admin' | 'user',
        settings: toSettings(s.data()),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async getById(
    id: string,
  ): Promise<{ id: string; name: string; city: string | null; settings: ChurchSettings } | null> {
    const snap = await this.collection().doc(id).get()
    if (!snap.exists) return null
    return {
      id: snap.id,
      name: snap.data()!.name,
      city: snap.data()!.city ?? null,
      settings: toSettings(snap.data()),
    }
  }

  async updateSettings(id: string, dto: UpdateChurchSettingsDto): Promise<ChurchSettings> {
    const settings: ChurchSettings = { instruments: sanitizeList(dto.instruments) }
    if (settings.instruments.length === 0) {
      throw new BadRequestException('La lista debe tener al menos un valor.')
    }
    await this.collection().doc(id).update({
      settings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return settings
  }
}
