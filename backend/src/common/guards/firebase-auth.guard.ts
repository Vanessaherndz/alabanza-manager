import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import * as admin from 'firebase-admin'
import { FIREBASE_AUTH } from '../../firebase/firebase.constants'
import { AuthenticatedRequest } from '../interfaces/authenticated-request'

// Verifica el ID token de Firebase enviado como "Authorization: Bearer <token>"
// en cada request. Se registra como guard global en AppModule.
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(@Inject(FIREBASE_AUTH) private readonly auth: admin.auth.Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const header = request.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null

    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticacion')
    }

    try {
      const decoded = await this.auth.verifyIdToken(token)
      request.user = { uid: decoded.uid, email: decoded.email }
      return true
    } catch {
      throw new UnauthorizedException('Token invalido o expirado')
    }
  }
}
