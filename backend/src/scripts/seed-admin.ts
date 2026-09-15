// Crea (o actualiza) el primer administrador del sistema.
// Uso: configura SEED_ADMIN_* en backend/.env y corre `npm run seed:admin`.
import 'reflect-metadata'
import * as dotenv from 'dotenv'
import * as admin from 'firebase-admin'
import { isValidUsername, usernameToEmail } from '../common/username.util'

dotenv.config()

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME
  const password = process.env.SEED_ADMIN_PASSWORD
  const fullName = process.env.SEED_ADMIN_FULL_NAME || username
  const domain = process.env.USERNAME_DOMAIN

  if (!username || !password || !domain) {
    throw new Error(
      'Faltan SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD o USERNAME_DOMAIN en backend/.env',
    )
  }
  if (!isValidUsername(username)) {
    throw new Error('SEED_ADMIN_USERNAME no es un usuario valido')
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })

  const email = usernameToEmail(username, domain)
  const auth = admin.auth()
  const db = admin.firestore()

  let uid: string
  try {
    const existing = await auth.getUserByEmail(email)
    uid = existing.uid
    await auth.updateUser(uid, { password, displayName: fullName })
    console.log(`Usuario "${username}" ya existia, contrasena actualizada.`)
  } catch {
    const created = await auth.createUser({ email, password, displayName: fullName })
    uid = created.uid
    console.log(`Usuario "${username}" creado.`)
  }

  await db
    .collection('users')
    .doc(uid)
    .set(
      {
        username: username.trim().toLowerCase(),
        fullName,
        phone: null,
        isSystemAdmin: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

  console.log(`"${username}" es ahora administrador del sistema (uid: ${uid}).`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
