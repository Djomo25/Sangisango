import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CommercantsService, ProfilCommercant } from './commercants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommercantConnecte } from '../auth/decorators/commercant-connecte.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import type { MettreAJourProfilDto } from './dto/mettre-a-jour-profil.dto';

@UseGuards(JwtAuthGuard)
@Controller('commercant')
export class CommercantsController {
  constructor(private readonly commercantsService: CommercantsService) {}

  @Get('moi')
  monProfil(@CommercantConnecte() commercant: JwtPayload): Promise<ProfilCommercant> {
    return this.commercantsService.monProfil(commercant.sub);
  }

  @Patch('moi')
  mettreAJourProfil(
    @CommercantConnecte() commercant: JwtPayload,
    @Body() dto: MettreAJourProfilDto,
  ): Promise<ProfilCommercant> {
    return this.commercantsService.mettreAJourProfil(commercant.sub, dto);
  }

  @Get('moi/lien-conversion')
  lienConversion(
    @CommercantConnecte() commercant: JwtPayload,
  ): Promise<{ lienConversion: string }> {
    return this.commercantsService.lienConversion(commercant.sub);
  }
}
