import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

const DUMMY_HASH = await argon2.hash("dummy-passwoord");

@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService) {}

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        })

        const hash = user?.passwordHash ?? DUMMY_HASH;
        const passwordOk = await argon2.verify(hash, dto.password);

        if(!user || !user.isActive || !passwordOk) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return { userId: user.id };
    }
}