/**
 * Full-stack e2e server (spec 17, AC-E2E-001..003): the real Nest application on a real local
 * Postgres, with only the external providers replaced – AI by FakeGeminiService, e-mail by an
 * in-memory inbox the browser test reads at GET /__e2e__/mail?to=<address>.
 *
 * Test-only: this file lives in test/, which is not part of the production build or image.
 * It refuses to start with NODE_ENV=production or a non-local / non-"test" database (see the guard).
 *
 *   E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5437/allgrafika_e2e_test npm run e2e:server
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { assertSafeE2eEnv } from './e2e-server-guard';

const databaseUrl = assertSafeE2eEnv(process.env);
const port = Number(process.env.E2E_PORT || 3999);
const frontendUrl = process.env.E2E_FRONTEND_URL || 'http://localhost:4175';
const uploadDir = path.join(os.tmpdir(), `allgrafika-e2e-uploads-${process.pid}`);
fs.mkdirSync(uploadDir, { recursive: true });

// Same isolation as the integration tests: never read .env, never touch real storage or providers.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  JWT_SECRET: 'e2e-jwt-secret-that-is-long-enough-for-validation-123456',
  JWT_EXPIRES_IN: '1h',
  FRONTEND_URL: frontendUrl,
  CORS_ORIGINS: frontendUrl,
  FREE_CREDITS_LIMIT: '10',
  SWAGGER_ENABLED: 'false',
  THROTTLE_DISABLED: 'true',
  BCRYPT_ROUNDS: '4',
  EMAIL_VERIFICATION_REQUIRED: 'true',
  B2_BUCKET_NAME: '',
  B2_ENDPOINT: '',
  B2_KEY_ID: '',
  B2_APPLICATION_KEY: '',
  LOCAL_UPLOAD_DIR: uploadDir,
  GEMINI_API_KEY: 'e2e-fake',
  OPENAI_API_KEY: 'e2e-fake',
  GOOGLE_CLIENT_ID: 'e2e-client-id.apps.googleusercontent.com',
  STRIPE_SECRET_KEY: '',
  SMTP_HOST: '',
});

async function main() {
  // Fresh schema on every start (the guard guarantees a local test database).
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: process.env,
  });

  // Imported after the environment is set – ConfigModule reads it at import time.
  const { Test } = await import('@nestjs/testing');
  const { ValidationPipe } = await import('@nestjs/common');
  const { default: cookieParser } = await import('cookie-parser');
  const { AppModule } = await import('../src/app.module');
  const { GeminiService } = await import('../src/generation/gemini.service');
  const { MailService } = await import('../src/mail/mail.service');
  const { requestIdMiddleware } = await import('../src/common/request-id.middleware');
  const { HttpExceptionFilter } = await import('../src/common/http-exception.filter');
  const { FakeGeminiService, FakeMailService } = await import('./fakes');

  const mail = new FakeMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GeminiService)
    .useValue(new FakeGeminiService())
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useStaticAssets(uploadDir, { prefix: '/api/uploads' });
  app.enableCors({ origin: [frontendUrl], credentials: true });
  app.setGlobalPrefix('api');

  // The test inbox – outside /api and only in this test server.
  app.getHttpAdapter().get('/__e2e__/mail', (req: Request, res: Response) => {
    const to = String(req.query.to || '').toLowerCase();
    res.json(mail.sent.filter((m) => m.to.toLowerCase() === to).map((m) => ({ subject: m.subject, text: m.text })));
  });

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`e2e server ready on http://localhost:${port} (frontend ${frontendUrl})`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
