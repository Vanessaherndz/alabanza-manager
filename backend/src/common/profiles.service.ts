import { Inject, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIRESTORE } from '../firebase/firebase.constants'
import { normalizeUsername } from './username.util'

export interface Profile {
  uid: string
  username: string | null
  fullName: string
  phone: string | null
  instrument: string | null
  isSystemAdmin: boolean
}

// Acceso a la coleccion "users": el perfil visible de cada cuenta
// (el registro de autenticacion en si vive en Firebase Auth).
@Injectable()
export class ProfilesService {
  constructor(@Inject(FIRESTORE) private readonly db: admin.firestore.Firestore) {}

  private collection() {
    return this.db.collection('users')
  }

  async createProfile(
    uid: string,
    data: { username: string; fullName: string; phone: string | null; instrument?: string | null },
  ): Promise<void> {
    await this.collection()
      .doc(uid)
      .set({
        username: normalizeUsername(data.username),
        fullName: data.fullName,
        phone: data.phone,
        instrument: data.instrument ?? null,
        isSystemAdmin: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
  }

  private toProfile(uid: string, data: admin.firestore.DocumentData): Profile {
    return {
      uid,
      username: data.username ?? null,
      fullName: data.fullName ?? '',
      phone: data.phone ?? null,
      instrument: data.instrument ?? null,
      isSystemAdmin: !!data.isSystemAdmin,
    }
  }

  // Miembros "de repertorio": no tienen cuenta (ni correo ni contrasena),
  // solo un nombre y opcionalmente un instrumento por defecto. Sirven para
  // asignarlos a un servicio sin que necesiten iniciar sesion.
  async createRosterProfile(data: { fullName: string; instrument: string | null }): Promise<string> {
    const ref = this.collection().doc()
    await ref.set({
      username: null,
      fullName: data.fullName,
      phone: null,
      instrument: data.instrument,
      isSystemAdmin: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return ref.id
  }

  async getProfile(uid: string): Promise<Profile | null> {
    const snap = await this.collection().doc(uid).get()
    if (!snap.exists) return null
    return this.toProfile(uid, snap.data()!)
  }

  async getProfiles(uids: string[]): Promise<Map<string, Profile>> {
    const map = new Map<string, Profile>()
    if (uids.length === 0) return map
    const unique = [...new Set(uids)]
    const refs = unique.map((uid) => this.collection().doc(uid))
    const snaps = await this.db.getAll(...refs)
    snaps.forEach((snap, i) => {
      if (!snap.exists) return
      map.set(unique[i], this.toProfile(unique[i], snap.data()!))
    })
    return map
  }

  async isSystemAdmin(uid: string): Promise<boolean> {
    const profile = await this.getProfile(uid)
    return !!profile?.isSystemAdmin
  }

  async findUidByUsername(username: string): Promise<string | null> {
    const snap = await this.collection()
      .where('username', '==', normalizeUsername(username))
      .limit(1)
      .get()
    return snap.empty ? null : snap.docs[0].id
  }
}
