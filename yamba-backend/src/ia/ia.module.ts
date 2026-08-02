import { forwardRef, Module } from '@nestjs/common';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CreneauxModule } from '../creneaux/creneaux.module';
import { RendezVousModule } from '../rendez-vous/rendez-vous.module';

@Module({
  imports: [forwardRef(() => WhatsappModule), CreneauxModule, forwardRef(() => RendezVousModule)],
  controllers: [IaController],
  providers: [IaService],
  exports: [IaService],
})
export class IaModule {}
