import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { ProfilesService } from '../common/profiles.service'
import { CreateEventDto } from './dto/create-event.dto'
import { AddSetlistSongDto } from './dto/add-setlist-song.dto'
import { UpdateSetlistSongDto } from './dto/update-setlist-song.dto'
import { AddAssignmentDto } from './dto/add-assignment.dto'

export interface EventSummary {
  id: string
  title: string
  startsAt: string
  location: string | null
  notes: string | null
}

@Injectable()
export class EventsService {
  constructor(
    @Inject(FIRESTORE) private readonly db: admin.firestore.Firestore,
    private readonly profiles: ProfilesService,
  ) {}

  private events() {
    return this.db.collection('events')
  }

  private songsCollection() {
    return this.db.collection('songs')
  }

  private setlist(eventId: string) {
    return this.events().doc(eventId).collection('songs')
  }

  private assignments(eventId: string) {
    return this.events().doc(eventId).collection('assignments')
  }

  private toIso(value: unknown): string | null {
    if (!value) return null
    if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString()
    return value as string
  }

  private toSummary(id: string, data: admin.firestore.DocumentData): EventSummary {
    return {
      id,
      title: data.title,
      startsAt: this.toIso(data.startsAt)!,
      location: data.location ?? null,
      notes: data.notes ?? null,
    }
  }

  async getChurchId(eventId: string): Promise<string | null> {
    const snap = await this.events().doc(eventId).get()
    return snap.exists ? (snap.data()!.churchId as string) : null
  }

  async listForChurch(
    churchId: string,
    opts: { upcoming?: boolean; from?: Date; to?: Date } = {},
  ): Promise<EventSummary[]> {
    let query: admin.firestore.Query = this.events()
      .where('churchId', '==', churchId)
      .where('type', '==', 'servicio')

    if (opts.upcoming) {
      query = query.where('startsAt', '>=', admin.firestore.Timestamp.fromDate(new Date()))
    }
    if (opts.from) query = query.where('startsAt', '>=', admin.firestore.Timestamp.fromDate(opts.from))
    if (opts.to) query = query.where('startsAt', '<', admin.firestore.Timestamp.fromDate(opts.to))

    const snap = await query.orderBy('startsAt', 'asc').get()
    return snap.docs.map((d) => this.toSummary(d.id, d.data()))
  }

  // La lista de servicios muestra el setlist y el equipo de cada uno, asi
  // que traemos el detalle completo (no solo el resumen).
  async listForChurchWithDetails(
    churchId: string,
    opts: { upcoming?: boolean; from?: Date; to?: Date } = {},
  ) {
    const summaries = await this.listForChurch(churchId, opts)
    return Promise.all(summaries.map((s) => this.getDetail(s.id)))
  }

  async create(churchId: string, uid: string, dto: CreateEventDto) {
    const ref = this.events().doc()
    const batch = this.db.batch()

    batch.set(ref, {
      churchId,
      type: 'servicio',
      title: dto.title,
      startsAt: admin.firestore.Timestamp.fromDate(new Date(dto.startsAt)),
      location: dto.location ?? null,
      notes: null,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    ;(dto.songs ?? []).forEach((song, index) => {
      const songRef = this.setlist(ref.id).doc()
      batch.set(songRef, {
        songId: song.songId,
        section: song.section ?? null,
        songKey: song.songKey ?? null,
        position: index + 1,
      })
    })

    ;(dto.assignments ?? []).forEach((assignment) => {
      const assignmentRef = this.assignments(ref.id).doc()
      batch.set(assignmentRef, {
        uid: assignment.uid,
        role: assignment.role,
        section: assignment.section ?? null,
        status: 'invitado',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    })

    await batch.commit()
    return { id: ref.id }
  }

  async remove(eventId: string) {
    const [songsSnap, assignmentsSnap] = await Promise.all([
      this.setlist(eventId).get(),
      this.assignments(eventId).get(),
    ])
    const batch = this.db.batch()
    songsSnap.docs.forEach((d) => batch.delete(d.ref))
    assignmentsSnap.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(this.events().doc(eventId))
    await batch.commit()
  }

  async getDetail(eventId: string) {
    const eventSnap = await this.events().doc(eventId).get()
    if (!eventSnap.exists) throw new NotFoundException('Servicio no encontrado')
    const event = eventSnap.data()!

    const [songsSnap, assignmentsSnap] = await Promise.all([
      this.setlist(eventId).orderBy('position', 'asc').get(),
      this.assignments(eventId).get(),
    ])

    const songIds = songsSnap.docs.map((d) => d.data().songId as string)
    const songsMap = new Map<string, admin.firestore.DocumentData>()
    if (songIds.length > 0) {
      const unique = [...new Set(songIds)]
      const refs = unique.map((id) => this.songsCollection().doc(id))
      const snaps = await this.db.getAll(...refs)
      snaps.forEach((s, i) => {
        if (s.exists) songsMap.set(unique[i], s.data()!)
      })
    }

    const uids = assignmentsSnap.docs.map((d) => d.data().uid as string)
    const profiles = await this.profiles.getProfiles(uids)

    return {
      id: eventSnap.id,
      churchId: event.churchId,
      title: event.title,
      startsAt: this.toIso(event.startsAt),
      location: event.location ?? null,
      notes: event.notes ?? null,
      songs: songsSnap.docs.map((d) => {
        const data = d.data()
        const song = songsMap.get(data.songId)
        return {
          id: d.id,
          position: data.position,
          section: data.section ?? null,
          songKey: data.songKey ?? null,
          song: song
            ? {
                id: data.songId,
                title: song.title,
                songKey: song.songKey ?? null,
                category: song.category ?? null,
              }
            : null,
        }
      }),
      assignments: assignmentsSnap.docs.map((d) => {
        const data = d.data()
        const profile = profiles.get(data.uid)
        return {
          id: d.id,
          role: data.role ?? null,
          section: data.section ?? null,
          status: data.status,
          profile: profile
            ? { id: profile.uid, username: profile.username, fullName: profile.fullName }
            : null,
        }
      }),
    }
  }

  async addSong(eventId: string, dto: AddSetlistSongDto) {
    const existing = await this.setlist(eventId).get()
    const nextPosition =
      existing.docs.reduce((max, d) => Math.max(max, d.data().position ?? 0), 0) + 1
    const ref = this.setlist(eventId).doc()
    await ref.set({
      songId: dto.songId,
      section: dto.section ?? null,
      songKey: dto.songKey ?? null,
      position: nextPosition,
    })
    return { id: ref.id }
  }

  async updateSong(eventId: string, rowId: string, dto: UpdateSetlistSongDto) {
    await this.setlist(eventId)
      .doc(rowId)
      .update({ section: dto.section ?? null })
  }

  async removeSong(eventId: string, rowId: string) {
    await this.setlist(eventId).doc(rowId).delete()
  }

  async addAssignment(eventId: string, dto: AddAssignmentDto) {
    const duplicate = await this.assignments(eventId)
      .where('uid', '==', dto.uid)
      .where('role', '==', dto.role ?? null)
      .limit(1)
      .get()
    if (!duplicate.empty) {
      throw new NotFoundException('Esa persona ya esta asignada con ese rol.')
    }
    const ref = this.assignments(eventId).doc()
    await ref.set({
      uid: dto.uid,
      role: dto.role ?? null,
      section: dto.section ?? null,
      status: 'invitado',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return { id: ref.id }
  }

  async getAssignment(eventId: string, rowId: string) {
    const snap = await this.assignments(eventId).doc(rowId).get()
    if (!snap.exists) throw new NotFoundException('Asignacion no encontrada')
    return { id: snap.id, ...snap.data() } as { id: string; uid: string; status: string }
  }

  async updateAssignmentStatus(eventId: string, rowId: string, status: string) {
    await this.assignments(eventId)
      .doc(rowId)
      .update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
  }

  async removeAssignment(eventId: string, rowId: string) {
    await this.assignments(eventId).doc(rowId).delete()
  }
}
