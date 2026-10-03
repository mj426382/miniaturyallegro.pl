import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ImagesModule } from './images/images.module';
import { GenerationModule } from './generation/generation.module';
import { PaymentsModule } from './payments/payments.module';
import { DemoModule } from './demo/demo.module';
import { AllegroModule } from './allegro/allegro.module';
import { AdminModule } from './admin/admin.module';
import { DescriptionsModule } from './descriptions/descriptions.module';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { HealthController } from './health/health.controller';
import { validateEnv } from './config/env.validation';
import { loggingModule } from './common/logging';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // Tests get their configuration from test/setup-env.ts and must never read the real .env.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    // Generous global limit (the app polls generation results); auth endpoints have
    // their own strict @Throttle() overrides.
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: Number(process.env.THROTTLE_LIMIT_PER_MINUTE) || 120,
        },
      ],
      // Integration tests disable rate limiting (THROTTLE_DISABLED=true) – never set this in production.
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    loggingModule(),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ImagesModule,
    GenerationModule,
    PaymentsModule,
    DemoModule,
    AllegroModule,
    AdminModule,
    DescriptionsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
