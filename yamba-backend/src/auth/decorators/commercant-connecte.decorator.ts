import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { RequestAvecCommercant } from '../guards/jwt-auth.guard';
import type { JwtPayload } from '../types/jwt-payload.type';

/**
 * Extrait le commerçant authentifié (sub, telephone) depuis le JWT décodé par
 * JwtAuthGuard. Seule source valable pour scoper une requête à un commerçant —
 * ne jamais accepter un commercantId venant de l'URL, du body ou d'un query param.
 */
export const CommercantConnecte = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<RequestAvecCommercant>();

    if (!request.commercant) {
      // Ne devrait jamais arriver si JwtAuthGuard est bien appliqué sur la route.
      throw new UnauthorizedException('Commerçant non authentifié.');
    }

    return request.commercant;
  },
);
