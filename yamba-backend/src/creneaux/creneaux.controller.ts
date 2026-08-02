import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { CreneauDisponible } from '@prisma/client';
import { CreneauxService, ListeCreneaux } from './creneaux.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommercantConnecte } from '../auth/decorators/commercant-connecte.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import type { CreerCreneauxDto } from './dto/creer-creneaux.dto';

@UseGuards(JwtAuthGuard)
@Controller('creneaux')
export class CreneauxController {
  constructor(private readonly creneauxService: CreneauxService) {}

  @Get()
  lister(
    @CommercantConnecte() commercant: JwtPayload,
    @Query('periode') periode?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ListeCreneaux> {
    return this.creneauxService.lister(commercant.sub, periode, limit, offset);
  }

  @Post()
  creer(
    @CommercantConnecte() commercant: JwtPayload,
    @Body() dto: CreerCreneauxDto,
  ): Promise<CreneauDisponible[]> {
    return this.creneauxService.creerPlusieurs(commercant.sub, dto.creneaux);
  }

  @Delete(':id')
  async supprimer(
    @CommercantConnecte() commercant: JwtPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.creneauxService.supprimer(commercant.sub, id);
    return { success: true };
  }
}
