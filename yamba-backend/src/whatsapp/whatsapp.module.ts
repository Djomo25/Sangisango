import { forwardRef, Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappSignatureGuard } from './guards/whatsapp-signature.guard';
import { IaModule } from '../ia/ia.module';

@Module({
  imports: [forwardRef(() => IaModule)],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappSignatureGuard],
  exports: [WhatsappService],
})
export class WhatsappModule {}
