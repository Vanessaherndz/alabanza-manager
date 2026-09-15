import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import * as admin from 'firebase-admin'
import { FIREBASE_APP, FIREBASE_AUTH, FIRESTORE } from './firebase.constants'

// Modulo global: inicializa una unica app de Firebase Admin y expone
// Auth y Firestore para que cualquier servicio los inyecte por token.
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FIREBASE_APP,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const projectId = config.getOrThrow<string>('FIREBASE_PROJECT_ID')
        const clientEmail = config.getOrThrow<string>('FIREBASE_CLIENT_EMAIL')
        const privateKey = config
          .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
          .replace(/\\n/g, '\n')

        return admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        })
      },
    },
    {
      provide: FIREBASE_AUTH,
      inject: [FIREBASE_APP],
      useFactory: (app: admin.app.App) => app.auth(),
    },
    {
      provide: FIRESTORE,
      inject: [FIREBASE_APP],
      useFactory: (app: admin.app.App) => app.firestore(),
    },
  ],
  exports: [FIREBASE_AUTH, FIRESTORE],
})
export class FirebaseModule {}
