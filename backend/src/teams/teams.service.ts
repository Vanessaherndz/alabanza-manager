import { Inject, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { CreateTeamDto } from './dto/create-team.dto'

@Injectable()
export class TeamsService {
  constructor(@Inject(FIRESTORE) private readonly db: admin.firestore.Firestore) {}

  private collection() {
    return this.db.collection('teams')
  }

  async list(churchId: string) {
    const snap = await this.collection().where('churchId', '==', churchId).orderBy('name').get()
    return snap.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      description: d.data().description ?? null,
    }))
  }

  async create(churchId: string, dto: CreateTeamDto) {
    const ref = this.collection().doc()
    await ref.set({
      churchId,
      name: dto.name,
      description: dto.description ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return { id: ref.id, name: dto.name, description: dto.description ?? null }
  }

  async remove(id: string) {
    await this.collection().doc(id).delete()
  }
}
