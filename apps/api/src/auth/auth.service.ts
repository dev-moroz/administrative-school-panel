import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtService } from "@nestjs/jwt";
import { randomBytes, createHash } from "node:crypto";
import { ConfigService } from "@nestjs/config";

const DUMMY_HASH = await argon2.hash("dummy-passwoord");

const DAY_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export interface AuthTokens {
    accessToken: string;
    accessExpiresAt: Date;
    refreshToken: string;
    expiresAt: Date;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) {}

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        })

        const hash = user?.passwordHash ?? DUMMY_HASH;
        const passwordOk = await argon2.verify(hash, dto.password);

        if(!user || !user.isActive || !passwordOk) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return this.issueTokens(user.id)
    }

    async refresh(rawToken: string | undefined): Promise<AuthTokens> {
        if (!rawToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const stored = await this.prisma.refreshToken.findUnique({
            where: { tokenHash: hashToken(rawToken) },
            include: { user: true },
        });

        if (!stored) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (stored.revokedAt) {
            await this.prisma.refreshToken.updateMany({
                where: { userId: stored.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (stored.expiresAt < new Date() || !stored.user.isActive) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.refreshToken.update({
                where: { id: stored.id },
                data: { revokedAt: new Date() },
            });
            return this.issueTokens(stored.userId, tx);
        });
    }

    async logout(rawToken: string | undefined) {
        if (!rawToken) return;

        await this.prisma.refreshToken.updateMany({
            where: { tokenHash: hashToken(rawToken), revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    private async issueTokens(userId: string, db: Pick<PrismaService, 'refreshToken'> = this.prisma) {
        const refreshToken = randomBytes(48).toString('base64url')
        const tokenHash = hashToken(refreshToken)

        const days = Number(this.config.getOrThrow('JWT_REFRESH_TTL_DAYS'))
        const expiresAt = new Date(Date.now() + days * DAY_MS)

        await db.refreshToken.create({ data: { userId, tokenHash, expiresAt } })

        const accessToken = await this.jwt.signAsync({ sub: userId })

        const { exp } = this.jwt.decode<{ exp: number }>(accessToken);
        const accessExpiresAt = new Date(exp * 1000);

        return { accessToken, accessExpiresAt, refreshToken, expiresAt }
    }
}