import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  IS_AUTHENTICATED_KEY,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
} from './auth.decorators.js';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authenticate(req.cookies?.access_token);
    req.user = user;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets);
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(
      IS_AUTHENTICATED_KEY,
      targets,
    );

    if (!required && !authenticatedOnly) {
      throw new ForbiddenException();
    }
    if (required && !required.every((p) => user.permissions.has(p))) {
      throw new ForbiddenException();
    }
    return true;
  }

  private async authenticate(token: string | undefined): Promise<AuthUser> {
    if (!token) throw new UnauthorizedException();

    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        algorithms: ['HS256'],
      });
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        teacher: { select: { id: true } },
        role: {
          select: {
            name: true,
            rolePermissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();

    return {
      id: user.id,
      email: user.email,
      role: user.role.name,
      teacherId: user.teacher?.id ?? null,
      permissions: new Set(user.role.rolePermissions.map((rp) => rp.permission.key)),
    };
  }
}
