import { Inject, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { ChurchAccessService } from '../common/church-access.service'
import { EventsService } from '../events/events.service'

const UPCOMING_LIMIT = 5
const POPULAR_LIMIT = 5
// Las canciones populares se calculan sobre los servicios del último año.
const POPULAR_WINDOW_MONTHS = 12
// Vista previa del próximo servicio: solo un adelanto, no el programa completo.
const PREVIEW_SONGS = 3
const VOICE_LEAD_ROLE = 'Voz Principal'

@Injectable()
export class DashboardService {
  constructor(
    @Inject(FIRESTORE) private readonly db: admin.firestore.Firestore,
    private readonly access: ChurchAccessService,
    private readonly events: EventsService,
  ) {}

  private servicesQuery(churchId: string, from: Date) {
    return this.db
      .collection('events')
      .where('churchId', '==', churchId)
      .where('type', '==', 'servicio')
      .where('startsAt', '>=', admin.firestore.Timestamp.fromDate(from))
  }

  async getSummary(churchId: string) {
    const now = new Date()
    const [eventsCount, songsCount, membersCount, upcoming, popularSongs] = await Promise.all([
      this.servicesQuery(churchId, now).count().get(),
      // El repertorio es compartido por todas las iglesias.
      this.db.collection('songs').count().get(),
      this.access.listMembers(churchId).then((m) => m.length),
      this.getUpcoming(churchId, now),
      this.getPopularSongs(churchId, now),
    ])

    return {
      stats: {
        servicios: eventsCount.data().count,
        canciones: songsCount.data().count,
        miembros: membersCount,
      },
      upcoming,
      nextPreview: upcoming.length > 0 ? await this.getPreview(upcoming[0].id) : null,
      popularSongs,
    }
  }

  private async getUpcoming(churchId: string, now: Date) {
    const snap = await this.servicesQuery(churchId, now)
      .orderBy('startsAt', 'asc')
      .limit(UPCOMING_LIMIT)
      .get()

    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        title: data.title as string,
        startsAt: (data.startsAt as admin.firestore.Timestamp).toDate().toISOString(),
        location: (data.location as string | null) ?? null,
      }
    })
  }

  private async getPreview(eventId: string) {
    const detail = await this.events.getDetail(eventId)

    // Una misma alabanza o voz puede repetirse en varias secciones.
    const titles = [...new Set(detail.songs.map((s) => s.song?.title).filter(Boolean))] as string[]
    const vocalLeads = [
      ...new Set(
        detail.assignments
          .filter((a) => a.role === VOICE_LEAD_ROLE)
          .map((a) => a.profile?.fullName || a.profile?.username)
          .filter(Boolean),
      ),
    ] as string[]
    const people = new Map<string, boolean>()
    for (const a of detail.assignments) {
      if (!a.profile) continue
      const confirmed = people.get(a.profile.id) ?? true
      people.set(a.profile.id, confirmed && a.status === 'confirmado')
    }

    return {
      songs: titles.slice(0, PREVIEW_SONGS),
      moreSongs: Math.max(0, titles.length - PREVIEW_SONGS),
      vocalLeads,
      team: people.size,
      confirmed: [...people.values()].filter(Boolean).length,
    }
  }

  private async getPopularSongs(churchId: string, now: Date) {
    const from = new Date(now)
    from.setMonth(from.getMonth() - POPULAR_WINDOW_MONTHS)

    const eventsSnap = await this.servicesQuery(churchId, from).select().get()
    const setlists = await Promise.all(
      eventsSnap.docs.map((d) => d.ref.collection('songs').select('songId').get()),
    )

    // Cuenta en cuántos servicios aparece cada canción (una vez por servicio).
    const counts = new Map<string, number>()
    for (const setlist of setlists) {
      const ids = new Set(setlist.docs.map((d) => d.data().songId as string).filter(Boolean))
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
    }

    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, POPULAR_LIMIT)
    if (top.length === 0) return []

    const songDocs = await this.db.getAll(
      ...top.map(([id]) => this.db.collection('songs').doc(id)),
    )

    return top
      .map(([id, uses], i) => {
        const doc = songDocs[i]
        if (!doc.exists) return null
        return {
          id,
          title: doc.data()!.title as string,
          songKey: (doc.data()!.songKey as string | null) ?? null,
          uses,
        }
      })
      .filter((s) => s !== null)
  }
}
