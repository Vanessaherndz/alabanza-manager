import { Controller, Get } from '@nestjs/common'
import { Public } from '../common/decorators/public.decorator'

// Endpoint liviano (sin Firestore) para "despertar" el servidor en Render
// y para el ping periodico que lo mantiene activo.
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { ok: true }
  }
}
