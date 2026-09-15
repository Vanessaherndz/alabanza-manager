import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { FirebaseModule } from './firebase/firebase.module'
import { CommonModule } from './common/common.module'
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard'
import { AuthModule } from './auth/auth.module'
import { ChurchesModule } from './churches/churches.module'
import { MembersModule } from './members/members.module'
import { TeamsModule } from './teams/teams.module'
import { SongsModule } from './songs/songs.module'
import { EventsModule } from './events/events.module'
import { DashboardModule } from './dashboard/dashboard.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    CommonModule,
    AuthModule,
    ChurchesModule,
    MembersModule,
    TeamsModule,
    SongsModule,
    EventsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
})
export class AppModule {}
