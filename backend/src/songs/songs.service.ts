import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { sanitizeList } from '../common/sanitize-list.util'
import { CreateSongDto } from './dto/create-song.dto'
import { UpdateSongDto } from './dto/update-song.dto'
import { DEFAULT_SONG_CATEGORIES } from './defaults'

function toDto(id: string, data: admin.firestore.DocumentData) {
  return {
    id,
    title: data.title,
    songKey: data.songKey ?? null,
    referenceUrl: data.referenceUrl ?? null,
    category: data.category ?? null,
  }
}

// El repertorio es compartido por todas las iglesias: una alabanza que
// agrega el admin de una iglesia queda disponible para todas las demas.
@Injectable()
export class SongsService {
  constructor(@Inject(FIRESTORE) private readonly db: admin.firestore.Firestore) {}

  private collection() {
    return this.db.collection('songs')
  }

  private categoriesDoc() {
    return this.db.collection('appSettings').doc('songCategories')
  }

  async getCategories(): Promise<string[]> {
    const snap = await this.categoriesDoc().get()
    return snap.exists ? (snap.data()!.categories as string[]) : DEFAULT_SONG_CATEGORIES
  }

  async updateCategories(categories: string[]): Promise<string[]> {
    const sanitized = sanitizeList(categories)
    if (sanitized.length === 0) {
      throw new BadRequestException('La lista debe tener al menos un valor.')
    }
    await this.categoriesDoc().set(
      { categories: sanitized, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    )
    return sanitized
  }

  private async assertValidCategory(category: string | undefined) {
    if (!category) return
    const categories = await this.getCategories()
    if (!categories.includes(category)) {
      throw new BadRequestException('Lista invalida.')
    }
  }

  async list() {
    const snap = await this.collection().orderBy('title').get()
    return snap.docs.map((d) => toDto(d.id, d.data()))
  }

  async create(uid: string, dto: CreateSongDto) {
    await this.assertValidCategory(dto.category)
    const ref = this.collection().doc()
    const data = {
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
    await this.assertValidCategory(dto.category)
    const ref = this.collection().doc(id)
    const snap = await ref.get()
    if (!snap.exists) throw new NotFoundException('Cancion no encontrada')
    await ref.update({ ...dto, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    const updated = await ref.get()
    return toDto(id, updated.data()!)
  }

  async remove(id: string) {
    await this.collection().doc(id).delete()
  }
}
