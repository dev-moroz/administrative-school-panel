import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Authenticated, CurrentUser, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';

const isProd = process.env.NODE_ENV === 'production';
const REFRESH_COOKIE_PATH = process.env.REFRESH_COOKIE_PATH ?? '/auth';

type Tokens = Awaited<ReturnType<AuthService['login']>>;

function setAuthCookies(res: Response, tokens: Tokens) {
  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    expires: tokens.accessExpiresAt,
  });

  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: REFRESH_COOKIE_PATH,
    expires: tokens.expiresAt,
  });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setAuthCookies(res, await this.authService.login(dto));
    return { ok: true };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token: string | undefined = req.cookies?.refresh_token;
    setAuthCookies(res, await this.authService.refresh(token));
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.cookies?.refresh_token);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: REFRESH_COOKIE_PATH });
    return { ok: true };
  }

  @Authenticated()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id, email: user.email, role: user.role, teacherId: user.teacherId, permissions: [...user.permissions] };
  }
}
