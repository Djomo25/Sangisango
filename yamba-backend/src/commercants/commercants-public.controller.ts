import { Body, Controller, Post } from '@nestjs/common';
import { CommercantsService, CommercantCree } from './commercants.service';
import { CreerCommercantDto } from './dto/creer-commercant.dto';

/**
 * Routes publiques (sans JwtAuthGuard) liées au cycle de vie du compte
 * commerçant — séparées de CommercantsController (`/commercant/...`, protégé)
 * qui ne concerne que le profil du commerçant déjà connecté.
 */
@Controller('commercants')
export class CommercantsPublicController {
  constructor(private readonly commercantsService: CommercantsService) {}

  @Post()
  creer(@Body() dto: CreerCommercantDto): Promise<CommercantCree> {
    return this.commercantsService.creer(dto);
  }
}
