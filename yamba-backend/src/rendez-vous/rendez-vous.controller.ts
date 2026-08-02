import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { RendezVous } from '@prisma/client';
import { RendezVousService, ListeRendezVous } from './rendez-vous.service';
import type { CreerRendezVousDto } from './dto/creer-rendez-vous.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommercantConnecte } from '../auth/decorators/commercant-connecte.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@UseGuards(JwtAuthGuard)
@Controller('rendez-vous')
export class RendezVousController {
  constructor(private readonly rendezVousService: RendezVousService) {}

  @Get()
  lister(
    @CommercantConnecte() commercant: JwtPayload,
    @Query('periode') periode?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ListeRendezVous> {
    return this.rendezVousService.lister(commercant.sub, periode, limit, offset);
  }

  @Post()
  creer(
    @CommercantConnecte() commercant: JwtPayload,
    @Body() dto: CreerRendezVousDto,
  ): Promise<RendezVous> {
    return this.rendezVousService.creerRendezVous(
      commercant.sub,
      dto.conversationId,
      dto.creneauId,
      dto.service,
    );
  }

  @Patch(':id/confirmer')
  confirmer(
    @CommercantConnecte() commercant: JwtPayload,
    @Param('id') id: string,
  ): Promise<RendezVous> {
    return this.rendezVousService.confirmerRendezVous(commercant.sub, id);
  }

  @Patch(':id/annuler')
  annuler(
    @CommercantConnecte() commercant: JwtPayload,
    @Param('id') id: string,
  ): Promise<RendezVous> {
    return this.rendezVousService.annulerRendezVous(commercant.sub, id);
  }
}
