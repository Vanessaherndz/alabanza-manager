import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { ProfilesService } from './profiles.service'

export type ChurchRole = 'admin' | 'user'

// Centraliza las reglas de acceso multi-iglesia que en el proyecto anterior
// vivian como policies de Row Level Security en Postgres: el admin del
// sistema ve/gestiona todo, y dentro de una iglesia el rol viene de
// memberships/{churchId}_{uid}.
@Injectable()
export class ChurchAccessService {
  constructor(
    @Inject(FIRESTORE) private readonly db: admin.firestore.Firestore,
    private readonly profiles: ProfilesService,
  ) {}

  private membershipId(churchId: string, uid: string) {
    return `${churchId}_${uid}`
  }

  async getRole(uid: string, churchId: string): Promise<ChurchRole | null> {
    if (await this.profiles.isSystemAdmin(uid)) return 'admin'
    const snap = await this.db
      .collection('memberships')
      .doc(this.membershipId(churchId, uid))
      .get()
    if (!snap.exists) return null
    return (snap.data()!.role as ChurchRole) ?? 'user'
  }

  async assertMember(uid: string, churchId: string): Promise<ChurchRole> {
    const role = await this.getRole(uid, churchId)
    if (!role) throw new ForbiddenException('No perteneces a esta iglesia')
    return role
  }

  async assertAdmin(uid: string, churchId: string): Promise<void> {
    const role = await this.getRole(uid, churchId)
    if (role !== 'admin') {
      throw new ForbiddenException('Solo un administrador puede hacer esto')
    }
  }

  async setMembership(
    churchId: string,
    uid: string,
    role: ChurchRole,
  ): Promise<void> {
    await this.db
      .collection('memberships')
      .doc(this.membershipId(churchId, uid))
      .set(
        {
          churchId,
          uid,
          role,
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
  }

  async removeMembership(churchId: string, uid: string): Promise<void> {
    await this.db.collection('memberships').doc(this.membershipId(churchId, uid)).delete()
  }

  async listChurchIdsForUser(uid: string): Promise<string[]> {
    const snap = await this.db.collection('memberships').where('uid', '==', uid).get()
    return snap.docs.map((d) => d.data().churchId as string)
  }

  async listMembers(churchId: string): Promise<{ uid: string; role: ChurchRole }[]> {
    const snap = await this.db
      .collection('memberships')
      .where('churchId', '==', churchId)
      .get()
    return snap.docs.map((d) => ({ uid: d.data().uid as string, role: d.data().role as ChurchRole }))
  }
}
