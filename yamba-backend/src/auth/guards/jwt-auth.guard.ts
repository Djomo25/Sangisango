import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from '../types/jwt-payload.type';

export interface RequestAvecCommercant extends Request {
  commercant?: JwtPayload;
}

/** Protège les routes du dashboard commerçant via un JWT (Authorization: Bearer <token>). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestAvecCommercant>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant.');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      request.commercant = this.jwtService.verify<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré.');
    }
  }
}
