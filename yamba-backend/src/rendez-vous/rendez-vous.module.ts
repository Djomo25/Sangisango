import { forwardRef, Module } from '@nestjs/common';
import { RendezVousController } from './rendez-vous.controller';
import { RendezVousService } from './rendez-vous.service';
import { CreneauxModule } from '../creneaux/creneaux.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [CreneauxModule, forwardRef(() => WhatsappModule)],
  controllers: [RendezVousController],
  providers: [RendezVousService],
  exports: [RendezVousService],
})
export class RendezVousModule {}
