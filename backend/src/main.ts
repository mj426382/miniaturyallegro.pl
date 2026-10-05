import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { initSentry } from './common/logging';
import { requestIdMiddleware } from './common/request-id.middleware';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { parseBool } from './config/env.validation';
import { buildCorsOrigins, DEFAULT_CORS_ORIGINS } from './common/cors';

export { DEFAULT_CORS_ORIGINS };

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';

  const sentryEnabled = initSentry();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bufferLogs: true });
  // Structured JSON logs with request id and user id (pino); pretty-printed outside production.
  app.useLogger(app.get(PinoLogger));
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  if (sentryEnabled) logger.log('Sentry error reporting enabled');

  // Behind a reverse proxy (Docker/nginx/Cloudflare) the real client IP lives in X-Forwarded-For.
  // Without this the rate limiter would treat every request as coming from the proxy.
  if (parseBool(process.env.TRUST_PROXY, isProd)) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      // API only – a strict CSP is safe in production; Swagger UI (dev) needs inline scripts.
      contentSecurityPolicy: isProd ? { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.disable('x-powered-by');
  app.use(cookieParser());

  // Local disk uploads are only used when Backblaze B2 is not configured (development).
  if (!process.env.B2_BUCKET_NAME) {
    const uploadDir = process.env.LOCAL_UPLOAD_DIR || '/app/uploads';
    app.useStaticAssets(uploadDir, { prefix: '/api/uploads' });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Web domains (or CORS_ORIGINS), the Android/iOS app origins (spec 18) and, outside production, Vite.
  const corsOrigins = buildCorsOrigins(process.env);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  // Swagger is a useful dev tool but leaks the full API surface; keep it off in production
  // unless explicitly enabled.
  if (parseBool(process.env.SWAGGER_ENABLED, !isProd)) {
    const config = new DocumentBuilder()
      .setTitle('AllGrafika API')
      .setDescription('API for generating product graphics')
      .setVersion('1.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  logger.log(`Application is running on port ${port} (${process.env.NODE_ENV || 'development'})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});
