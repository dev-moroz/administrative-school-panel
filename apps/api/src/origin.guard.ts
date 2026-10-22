import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const SKIP_ORIGIN_CHECK_KEY = 'skipOriginCheck';

export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK_KEY, true);

function parseOrigins(value = process.env.WEB_ORIGIN) {
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'WEB_ORIGIN is required in production: set it to the public URL of the web app, e.g. https://school.example.com',
      );
    }
    value = 'http://localhost:3000';
  }
  return value.split(',').map((o) => o.trim()).filter(Boolean);
}

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed = parseOrigins();

  constructor(private readonly reflector: Reflector) {
    Logger.log(`Allowed origins for mutating requests: ${this.allowed.join(', ')}`, 'OriginGuard');
  }

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN_CHECK_KEY, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }
    const origin = req.headers.origin;
    if (origin && this.allowed.includes(origin)) return true;
    throw new ForbiddenException('Forbidden origin');
  }
}
