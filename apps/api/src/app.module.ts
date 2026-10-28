import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { CurrenciesModule } from './currencies/currencies.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { LessonSeriesModule } from './lesson-series/lesson-series.module.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { OriginGuard } from './origin.guard.js';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StudentsModule } from './students/students.module.js';
import { TeachersModule } from './teachers/teachers.module.js';

@Module({
  imports: [
    // Node loads .env itself (--env-file in the scripts); in production the container env is used.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    // Soft global ceiling; stricter limits are set per route with @Throttle.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        skipIf: () => config.get('THROTTLE_DISABLED') === 'true',
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    StudentsModule,
    CurrenciesModule,
    TeachersModule,
    LedgerModule,
    PaymentMethodsModule,
    PaymentsModule,
    LessonsModule,
    LessonSeriesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
