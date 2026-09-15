import { Global, Module } from '@nestjs/common'
import { ProfilesService } from './profiles.service'
import { ChurchAccessService } from './church-access.service'

// Servicios compartidos por (casi) todos los modulos de dominio.
@Global()
@Module({
  providers: [ProfilesService, ChurchAccessService],
  exports: [ProfilesService, ChurchAccessService],
})
export class CommonModule {}
