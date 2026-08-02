import { Module } from '@nestjs/common';
import { CreneauxController } from './creneaux.controller';
import { CreneauxService } from './creneaux.service';

@Module({
  controllers: [CreneauxController],
  providers: [CreneauxService],
  exports: [CreneauxService],
})
export class CreneauxModule {}
