import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeminiService } from '../src/generation/gemini.service';
import { MailService } from '../src/mail/mail.service';
import { PaymentsService } from '../src/payments/payments.service';
import { FakeGeminiService, FakeMailService, makePng } from './fakes';
import { requestIdMiddleware } from '../src/common/request-id.middleware';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  gemini: FakeGeminiService;
  mail: FakeMailService;
  payments: PaymentsService;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const gemini = new FakeGeminiService();
  const mail = new FakeMailService();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GeminiService)
    .useValue(gemini)
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.init();

  const prisma = app.get(PrismaService);
  const payments = app.get(PaymentsService);

  return {
    app,
    prisma,
    gemini,
    mail,
    payments,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
    },
  };
}

/** Wipes all rows between tests (order matters because of FKs – cascade handles it). */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users", "demo_requests" RESTART IDENTITY CASCADE');
}

let counter = 0;
export function uniqueEmail(prefix = 'user'): string {
  counter++;
  return `${prefix}-${Date.now()}-${counter}@test.allgrafika.pl`;
}

export const STRONG_PASSWORD = 'Str0ng!Passw0rd';

export async function registerUser(ctx: TestContext, email = uniqueEmail()) {
  const res = await ctx
    .http()
    .post('/api/auth/register')
    .send({ email, password: STRONG_PASSWORD, name: 'Test User', acceptedTerms: true })
    .expect(201);
  return { email, token: res.body.token as string, userId: res.body.user.id as string };
}

export async function uploadImage(ctx: TestContext, token: string) {
  const png = await makePng({ r: 10, g: 200, b: 10 }, 128);
  const res = await ctx
    .http()
    .post('/api/images/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', png, { filename: 'product.png', contentType: 'image/png' })
    .expect(201);
  return res.body as { id: string; originalUrl: string };
}

/** Polls until every generation of the image reaches a terminal state. */
export async function waitForGenerations(ctx: TestContext, imageId: string, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await ctx.prisma.generation.findMany({ where: { imageId } });
    if (rows.length && rows.every((g) => g.status === 'COMPLETED' || g.status === 'FAILED')) return rows;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Timed out waiting for generations');
}

/** Polls until `check` returns true (refunds happen asynchronously after a status flip). */
export async function waitFor(check: () => Promise<boolean>, timeoutMs = 5_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Timed out waiting for condition');
}

export async function getCredits(ctx: TestContext, userId: string) {
  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { credits: user.credits, freeCreditsUsed: user.freeCreditsUsed };
}
