import { Inject, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { ChurchAccessService } from '../common/church-access.service'

@Injectable()
export class DashboardService {
  constructor(
    @Inject(FIRESTORE) private readonly db: admin.firestore.Firestore,
    private readonly access: ChurchAccessService,
  ) {}

  async getSummary(churchId: string) {
    const [eventsCount, songsCount, membersCount] = await Promise.all([
      this.db
        .collection('events')
        .where('churchId', '==', churchId)
        .where('type', '==', 'servicio')
        .where('startsAt', '>=', admin.firestore.Timestamp.fromDate(new Date()))
        .count()
        .get(),
      this.db.collection('songs').where('churchId', '==', churchId).count().get(),
      this.access.listMembers(churchId).then((m) => m.length),
    ])

    return {
      stats: {
        servicios: eventsCount.data().count,
        canciones: songsCount.data().count,
        miembros: membersCount,
      },
    }
  }
}
