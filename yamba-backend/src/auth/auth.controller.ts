import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { DemanderCodeDto } from './dto/demander-code.dto';
import type { VerifierCodeDto } from './dto/verifier-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('demander-code')
  @HttpCode(200)
  demanderCode(@Body() dto: DemanderCodeDto): Promise<{ code?: string }> {
    return this.authService.demanderCode(dto.telephone);
  }

  @Post('verifier-code')
  @HttpCode(200)
  verifierCode(@Body() dto: VerifierCodeDto): Promise<{ accessToken: string }> {
    return this.authService.verifierCode(dto.telephone, dto.code);
  }
}
