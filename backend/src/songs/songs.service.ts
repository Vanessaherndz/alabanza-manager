import { Inject, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { CreateSongDto } from './dto/create-song.dto'
import { UpdateSongDto } from './dto/update-song.dto'

function toDto(id: string, data: admin.firestore.DocumentData) {
  return {
    id,
    title: data.title,
    songKey: data.songKey ?? null,
    referenceUrl: data.referenceUrl ?? null,
    category: data.category ?? null,
  }
}

@Injectable()
export class SongsService {
  constructor(@Inject(FIRESTORE) private readonly db: admin.firestore.Firestore) {}

  private collection() {
    return this.db.collection('songs')
  }

  async list(churchId: string) {
    const snap = await this.collection().where('churchId', '==', churchId).orderBy('title').get()
    return snap.docs.map((d) => toDto(d.id, d.data()))
  }

  async create(churchId: string, uid: string, dto: CreateSongDto) {
    const ref = this.collection().doc()
    const data = {
      churchId,
      title: dto.title,
      songKey: dto.songKey ?? null,
      referenceUrl: dto.referenceUrl ?? null,
      category: dto.category ?? null,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    await ref.set(data)
    return toDto(ref.id, data)
  }

  async update(id: string, dto: UpdateSongDto) {
    await this.collection()
      .doc(id)
      .update({ ...dto, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    const snap = await this.collection().doc(id).get()
    return toDto(id, snap.data()!)
  }

  async remove(id: string) {
    await this.collection().doc(id).delete()
  }

  async getChurchId(id: string): Promise<string | null> {
    const snap = await this.collection().doc(id).get()
    return snap.exists ? (snap.data()!.churchId as string) : null
  }
}
