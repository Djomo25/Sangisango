import { Module } from '@nestjs/common';
import { CommercantsController } from './commercants.controller';
import { CommercantsPublicController } from './commercants-public.controller';
import { CommercantsService } from './commercants.service';

@Module({
  controllers: [CommercantsController, CommercantsPublicController],
  providers: [CommercantsService],
})
export class CommercantsModule {}
