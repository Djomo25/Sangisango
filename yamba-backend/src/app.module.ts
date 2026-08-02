import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CommercantsModule } from './commercants/commercants.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { CreneauxModule } from './creneaux/creneaux.module';
import { RendezVousModule } from './rendez-vous/rendez-vous.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { IaModule } from './ia/ia.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommercantsModule,
    ConversationsModule,
    MessagesModule,
    CreneauxModule,
    RendezVousModule,
    WhatsappModule,
    IaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
