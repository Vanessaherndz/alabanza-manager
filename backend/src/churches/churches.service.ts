import { Inject, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { ChurchAccessService } from '../common/church-access.service'
import { ProfilesService } from '../common/profiles.service'
import { CreateChurchDto } from './dto/create-church.dto'

export interface ChurchWithRole {
  id: string
  name: string
  city: string | null
  role: 'admin' | 'user'
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
    await ref.set({
      name: dto.name,
      city: dto.city ?? null,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    await this.access.setMembership(ref.id, uid, 'admin')
    return { id: ref.id, name: dto.name, city: dto.city ?? null, role: 'admin' }
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
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async getById(id: string): Promise<{ id: string; name: string; city: string | null } | null> {
    const snap = await this.collection().doc(id).get()
    if (!snap.exists) return null
    return { id: snap.id, name: snap.data()!.name, city: snap.data()!.city ?? null }
  }
}
