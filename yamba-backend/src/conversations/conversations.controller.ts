import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommercantConnecte } from '../auth/decorators/commercant-connecte.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import type { CreerCorrectionDto } from './dto/creer-correction.dto';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  lister(
    @CommercantConnecte() commercant: JwtPayload,
    @Query('statut') statut?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.conversationsService.lister(commercant.sub, statut, limit, offset);
  }

  @Get(':id')
  detail(@CommercantConnecte() commercant: JwtPayload, @Param('id') id: string) {
    return this.conversationsService.detail(commercant.sub, id);
  }

  @Patch(':id/prendre-la-main')
  prendreLaMain(@CommercantConnecte() commercant: JwtPayload, @Param('id') id: string) {
    return this.conversationsService.prendreLaMain(commercant.sub, id);
  }

  @Patch(':id/terminer')
  terminer(@CommercantConnecte() commercant: JwtPayload, @Param('id') id: string) {
    return this.conversationsService.terminer(commercant.sub, id);
  }

  @Post(':id/corrections')
  ajouterCorrection(
    @CommercantConnecte() commercant: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreerCorrectionDto,
  ) {
    return this.conversationsService.ajouterCorrection(
      commercant.sub,
      id,
      dto.messageOriginalId,
      dto.suggestionCommercant,
    );
  }
}
