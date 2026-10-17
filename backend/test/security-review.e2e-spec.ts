import { createHash } from 'crypto';
import * as yauzl from 'yauzl';
import { JwtService } from '@nestjs/jwt';
import sharp from 'sharp';
import {
  createTestApp,
  registerUser,
  resetDatabase,
  STRONG_PASSWORD,
  TestContext,
  uniqueEmail,
  uploadImage,
  waitForGenerations,
} from './test-app';
import { makePng } from './fakes';
import { AUTHOR_XMP, digitalSourceType, hasGpsTag, photoWithMetadata } from './metadata-fixtures';
import { landingLegalEntity } from './legal-entity-source';
import { AuthService } from '../src/auth/auth.service';
import { SESSION_COOKIE } from '../src/auth/session-cookie';
import { NotificationsService } from '../src/notifications/notifications.service';
import { DemoService, DEMO_POLL_LIMIT_PER_MINUTE } from '../src/demo/demo.service';
import { HEALTH_LIMIT_PER_MINUTE } from '../src/health/health.controller';
import { AdminGuard } from '../src/admin/admin.guard';
import { UsersService } from '../src/users/users.service';
import { derivePurposeKey, keyedHash } from '../src/common/keys';
import { USER_GENERATION_FIELDS } from '../src/generation/generation-response';
import { AI_DIGITAL_SOURCE_TYPE } from '../src/generation/export.service';
import { getStyle } from '../src/generation/styles';
import { StorageService } from '../src/images/storage.service';

/** Collects the raw response body (supertest parses only text/JSON by default). */
function binaryParser(res: any, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

function readZip(buffer: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err);
      const files = new Map<string, Buffer>();
      zip.on('entry', (entry: yauzl.Entry) => {
        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) return reject(e);
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            files.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => resolve(files));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

const DAY = 24 * 60 * 60 * 1000;
const WEB = 'https://app.allgrafika.pl';
const ANDROID = 'https://native.allgrafika.pl';
const IOS = 'capacitor://native.allgrafika.pl';

/** Security & privacy review 2026-10-17 – the cross-cutting fixes. */
describe('security review 2026-10-17 (integration)', () => {
  let ctx: TestContext;
  let notifications: NotificationsService;
  let jwt: JwtService;
  const googlePayloads: any[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    notifications = ctx.app.get(NotificationsService);
    jwt = ctx.app.get(JwtService);
    const service = ctx.app.get(AuthService) as any;
    service.googleClientId = 'test-client';
    service.googleClient = { verifyIdToken: async () => ({ getPayload: () => googlePayloads.shift() }) };
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.mail.sent = [];
    ctx.gemini.failStyles.clear();
    googlePayloads.length = 0;
  });

  function sessionCookie(res: { headers: Record<string, any> }): string {
    const cookies: string[] = res.headers['set-cookie'] ?? [];
    const cookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(cookie).toBeDefined();
    return cookie!.split(';')[0];
  }

  /** GET /users/me with the cookie only, the way the web app calls it. */
  function meWithCookie(cookie: string) {
    return ctx.http().get('/api/users/me').set('Cookie', cookie).set('X-Requested-With', 'XMLHttpRequest');
  }

  // ─── Item 5: the JWT in the response body ────────────────────────────

  describe('session token in the body', () => {
    /**
     * Register, log in, Google sign-in and change the password with the given headers. Each session is
     * checked right after it is issued (cookie, and the body token when there is one) – the password
     * change at the end legitimately ends the earlier sessions.
     */
    async function allAuthResponses(headers: Record<string, string>) {
      const works = async (res: { body: any; headers: Record<string, any> }) => {
        await meWithCookie(sessionCookie(res)).expect(200);
        if (res.body.token) await ctx.http().get('/api/users/me').set(auth(res.body.token)).expect(200);
        return res;
      };
      const email = uniqueEmail('token');
      const register = await ctx
        .http()
        .post('/api/auth/register')
        .set(headers)
        .send({ email, password: STRONG_PASSWORD, acceptedTerms: true })
        .expect(201)
        .then(works);
      const login = await ctx
        .http()
        .post('/api/auth/login')
        .set(headers)
        .send({ email, password: STRONG_PASSWORD })
        .expect(200)
        .then(works);
      googlePayloads.push({ sub: `g-${email}`, email: `g-${email}`, email_verified: true });
      const google = await ctx
        .http()
        .post('/api/auth/google')
        .set(headers)
        .send({ googleToken: 't', acceptedTerms: true })
        .expect(200)
        .then(works);
      const change = await ctx
        .http()
        .post('/api/auth/change-password')
        .set(headers)
        .set('Cookie', sessionCookie(login))
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ currentPassword: STRONG_PASSWORD, newPassword: 'N0we!Haslo-2026' })
        .expect(201)
        .then(works);
      return { register, login, google, change };
    }

    it('[AC-AUTH-028] a web browser gets the httpOnly cookie only – never the token in the body', async () => {
      for (const headers of [
        { Origin: WEB },
        { Origin: 'http://localhost:5173' },
        // A browser request without Origin still carries fetch metadata.
        { 'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Mode': 'cors' },
        // An injected script can add any custom header, but not the app Origin.
        { Origin: WEB, 'X-AllGrafika-Client': 'native' },
      ]) {
        const responses = await allAuthResponses(headers);
        for (const [name, res] of Object.entries(responses)) {
          expect({ name, hasToken: 'token' in res.body }).toEqual({ name, hasToken: false });
          // No JWT anywhere in the body; the cookie carried the session (checked in allAuthResponses).
          expect(JSON.stringify(res.body)).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
        }
        expect(responses.register.body.user).toMatchObject({ emailVerified: false });
        expect(responses.change.body.message).toBe('Hasło zostało zmienione.');
      }
    });

    it('[AC-MOB-009] the Android and iOS apps get a working Bearer token from every auth endpoint', async () => {
      for (const origin of [ANDROID, IOS]) {
        const { register, login, google, change } = await allAuthResponses({ Origin: origin });
        // Every token was a working Bearer session when issued (checked in allAuthResponses).
        for (const res of [register, login, google, change]) expect(res.body.token).toMatch(/^eyJ/);
        // After a password change the app keeps working with the token it got back.
        await ctx.http().get('/api/users/me').set(auth(change.body.token)).expect(200);
      }
    });

    it('[AC-AUTH-028] scripts and server clients (no Origin, no Sec-Fetch-*) still receive the token', async () => {
      const responses = await allAuthResponses({});
      for (const res of Object.values(responses)) expect(res.body.token).toMatch(/^eyJ/);
    });
  });

  // ─── Item 3: purpose keys for unsubscribe links and the demo IP hash ──

  describe('unsubscribe tokens', () => {
    async function consentingUser() {
      const user = await registerUser(ctx);
      await ctx.prisma.user.update({ where: { id: user.userId }, data: { marketingConsentAt: new Date() } });
      return user;
    }
    const consent = async (userId: string) =>
      (await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } })).marketingConsentAt;
    const unsubscribe = (token: string) => ctx.http().post(`/api/notifications/unsubscribe?token=${token}`);
    const unsubscribeKey = () => derivePurposeKey('unsubscribe-token', process.env);

    it('[AC-NOT-011] new tokens use the purpose key, carry v: 2 and expire after 2 years; links and one-click work', async () => {
      const user = await consentingUser();
      const token = notifications.unsubscribeToken(user.userId);
      const payload = jwt.decode(token) as any;
      expect(payload).toMatchObject({ sub: user.userId, purpose: 'unsubscribe', v: 2 });
      expect(payload.exp - payload.iat).toBe(730 * 24 * 60 * 60);
      // Not signed with JWT_SECRET any more…
      expect(() => jwt.verify(token)).toThrow();
      // …but with the derived unsubscribe key.
      expect(jwt.verify(token, { secret: unsubscribeKey() })).toMatchObject({ v: 2 });
      // Still valid just before 2 years, invalid after.
      expect(notifications.verifyUnsubscribeToken(token, new Date(Date.now() + 729 * DAY))).toBe(user.userId);
      expect(notifications.verifyUnsubscribeToken(token, new Date(Date.now() + 731 * DAY))).toBeNull();

      // RFC 8058 one-click POST from the List-Unsubscribe header.
      await ctx
        .http()
        .post(`/api/notifications/unsubscribe?token=${token}`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('List-Unsubscribe=One-Click')
        .expect(200, { unsubscribed: true });
      expect(await consent(user.userId)).toBeNull();
    });

    it('[AC-NOT-011] marketing mails carry the new token in the link and in List-Unsubscribe (RFC 8058)', async () => {
      const user = await consentingUser();
      await ctx.prisma.user.update({
        where: { id: user.userId },
        data: { createdAt: new Date('2026-10-16T10:00:00Z') },
      });
      expect((await notifications.runReminderJob(new Date('2026-10-20T10:00:00Z'))).free).toBe(1);
      const mail = ctx.mail.sent.find((m) => m.to === user.email && /czeka/.test(m.subject))!;
      expect(mail.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      const headerToken = mail.headers!['List-Unsubscribe'].match(/token=([^>]+)>/)![1];
      const linkToken = mail.text.match(/unsubscribe\?token=([A-Za-z0-9._-]+)/)![1];
      for (const t of [headerToken, linkToken]) expect((jwt.decode(t) as any).v).toBe(2);
      // GET (mail clients without RFC 8058) only redirects; POST withdraws.
      await ctx.http().get(`/api/notifications/unsubscribe?token=${headerToken}`).expect(302);
      expect(await consent(user.userId)).toBeInstanceOf(Date);
      await unsubscribe(headerToken).expect(200);
      expect(await consent(user.userId)).toBeNull();
    });

    it('[AC-NOT-011] links already in inboxes (JWT_SECRET, before the cut-over) keep working', async () => {
      const user = await consentingUser();
      // Exactly what the code before 2026-10-18 issued.
      const legacy = jwt.sign({ sub: user.userId, purpose: 'unsubscribe' }, { expiresIn: '3650d' });
      await unsubscribe(legacy).expect(200);
      expect(await consent(user.userId)).toBeNull();

      // Issued a year ago – still fine.
      const other = await consentingUser();
      const yearAgo = Math.floor((Date.now() - 365 * DAY) / 1000);
      await unsubscribe(
        jwt.sign({ sub: other.userId, purpose: 'unsubscribe', iat: yearAgo }, { expiresIn: '3650d' }),
      ).expect(200);
    });

    it('[AC-NOT-011] rejects tampered, expired, late legacy, other-purpose and session tokens; the token is no session', async () => {
      const user = await consentingUser();
      const now = Math.floor(Date.now() / 1000);
      const good = notifications.unsubscribeToken(user.userId);
      const [h, p, s] = good.split('.');
      const forgedPayload = Buffer.from(JSON.stringify({ ...(jwt.decode(good) as any), sub: 'someone-else' })).toString(
        'base64url',
      );
      const rejected: Record<string, string> = {
        'tampered signature': `${h}.${p}.${s.slice(0, -3)}${s.slice(-3) === 'AAA' ? 'BBB' : 'AAA'}`,
        'tampered payload': `${h}.${forgedPayload}.${s}`,
        'expired new token': jwt.sign(
          { sub: user.userId, purpose: 'unsubscribe', v: 2, iat: now - 800 * 86400 },
          { secret: unsubscribeKey(), expiresIn: '730d' },
        ),
        'legacy issued after the cut-over': jwt.sign(
          { sub: user.userId, purpose: 'unsubscribe', iat: Math.floor(Date.parse('2026-12-02T00:00:00Z') / 1000) },
          { expiresIn: '3650d' },
        ),
        'legacy older than 2 years': jwt.sign(
          { sub: user.userId, purpose: 'unsubscribe', iat: now - 731 * 86400 },
          { expiresIn: '3650d' },
        ),
        'versioned token signed with JWT_SECRET': jwt.sign({ sub: user.userId, purpose: 'unsubscribe', v: 2 }),
        'session token': user.token,
        'unsubscribe key, other purpose': jwt.sign(
          { sub: user.userId, purpose: 'session', v: 2 },
          { secret: unsubscribeKey(), expiresIn: '1d' },
        ),
        'unsubscribe key, no version': jwt.sign(
          { sub: user.userId, purpose: 'unsubscribe' },
          { secret: unsubscribeKey(), expiresIn: '1d' },
        ),
        'demo key': jwt.sign(
          { sub: user.userId, purpose: 'unsubscribe', v: 2 },
          { secret: derivePurposeKey('demo-ip-hash', process.env), expiresIn: '1d' },
        ),
        'tombstone key': jwt.sign(
          { sub: user.userId, purpose: 'unsubscribe', v: 2 },
          { secret: derivePurposeKey('account-tombstone', process.env), expiresIn: '1d' },
        ),
        'alg none': `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${p}.`,
        garbage: 'nonsense',
      };
      for (const [name, token] of Object.entries(rejected)) {
        const res = await unsubscribe(token);
        expect({ name, status: res.status }).toEqual({ name, status: 400 });
      }
      expect(await consent(user.userId)).toBeInstanceOf(Date);

      // A late legacy token is also refused when the operator moves the cut-over back.
      const service = notifications as any;
      const cutover = service.legacyCutoverMs;
      service.legacyCutoverMs = Date.now() - DAY;
      try {
        await unsubscribe(jwt.sign({ sub: user.userId, purpose: 'unsubscribe' }, { expiresIn: '3650d' })).expect(400);
      } finally {
        service.legacyCutoverMs = cutover;
      }

      // Neither the new nor the legacy unsubscribe token authenticates API calls.
      await ctx.http().get('/api/users/me').set(auth(good)).expect(401);
      const legacy = jwt.sign({ sub: user.userId, purpose: 'unsubscribe' }, { expiresIn: '3650d' });
      await ctx.http().get('/api/users/me').set(auth(legacy)).expect(401);
      expect(await consent(user.userId)).toBeInstanceOf(Date);
    });

    it('[AC-SEC-014] the demo IP hash is an HMAC with the demo key, not sha256(ip|JWT_SECRET)', async () => {
      const res = await ctx
        .http()
        .post('/api/demo')
        .field('email', 'ip-hash@example.com')
        .attach('file', await makePng({ r: 5, g: 5, b: 5 }, 128), { filename: 'p.png', contentType: 'image/png' })
        .expect(201);
      const row = await ctx.prisma.demoRequest.findUniqueOrThrow({ where: { id: res.body.id } });
      const key = derivePurposeKey('demo-ip-hash', process.env);
      const candidates = ['::ffff:127.0.0.1', '127.0.0.1', '::1'];
      const ip = candidates.find((c) => keyedHash(key, c) === row.ipHash);
      expect(ip).toBeDefined();
      expect(row.ipHash).toBe(ctx.app.get(DemoService).hashIp(ip!));
      expect(row.ipHash).not.toBe(createHash('sha256').update(`${ip}|${process.env.JWT_SECRET}`).digest('hex'));
      expect(row.ipHash).not.toBe(keyedHash(derivePurposeKey('unsubscribe-token', process.env), ip!));
      expect(row.ipHash).not.toContain(ip!);
      await waitForDemo(row.id);
    });
  });

  // ─── Item 4: public GETs ───────────────────────────────────────────────

  async function waitForDemo(id: string) {
    for (let i = 0; i < 100; i++) {
      const { status } = await ctx.prisma.demoRequest.findUniqueOrThrow({ where: { id } });
      if (status === 'COMPLETED' || status === 'FAILED') return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  describe('public endpoints', () => {
    it('[AC-SEC-013] demo ids carry 128 random bits; malformed ids are 404 without a database query; old ids still work', async () => {
      const ids: string[] = [];
      for (const email of ['los1@example.com', 'los2@example.com']) {
        const res = await ctx
          .http()
          .post('/api/demo')
          .field('email', email)
          .attach('file', await makePng({ r: 9, g: 9, b: 9 }, 128), { filename: 'p.png', contentType: 'image/png' })
          .expect(201);
        ids.push(res.body.id);
      }
      for (const id of ids) {
        expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
        expect(Buffer.from(id, 'base64url')).toHaveLength(16);
        await ctx.http().get(`/api/demo/${id}`).expect(200);
        await waitForDemo(id);
      }
      expect(ids[0]).not.toBe(ids[1]);
      // Not a cuid: no shared time/counter prefix between consecutive ids.
      expect(ids[0].slice(0, 8)).not.toBe(ids[1].slice(0, 8));

      // A row created before the change (cuid) still resolves.
      const legacy = await ctx.prisma.demoRequest.create({
        data: { email: 'stare@example.com', ipHash: 'h', imageKey: 'demo/x.png', status: 'COMPLETED' },
      });
      expect(legacy.id).toMatch(/^c[a-z0-9]{24}$/);
      await ctx.http().get(`/api/demo/${legacy.id}`).expect(200);

      const spy = jest.spyOn(ctx.prisma.demoRequest, 'findUnique');
      try {
        for (const bad of ['ok', 'x', "' OR 1=1 --", 'a'.repeat(200)]) {
          await ctx
            .http()
            .get(`/api/demo/${encodeURIComponent(bad)}`)
            .expect(404);
        }
        expect(spy).not.toHaveBeenCalled();
        // (the spy is live: a well-formed id does reach the database)
        await ctx.http().get(`/api/demo/${legacy.id}`).expect(200);
        expect(spy).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });

    it('[AC-SEC-013] a burst on GET /demo/:id and GET /health from one IP gets 429', async () => {
      const legacy = await ctx.prisma.demoRequest.create({
        data: { email: 'burst@example.com', ipHash: 'h', imageKey: 'demo/x.png', status: 'COMPLETED' },
      });
      process.env.THROTTLE_DISABLED = 'false';
      try {
        // Normal polling (every 3 s → 20/min) stays well below the limit.
        expect(DEMO_POLL_LIMIT_PER_MINUTE).toBe(30);
        const demo: number[] = [];
        for (let i = 0; i < DEMO_POLL_LIMIT_PER_MINUTE + 5; i++) {
          demo.push((await ctx.http().get(`/api/demo/${legacy.id}`)).status);
        }
        expect(demo.slice(0, DEMO_POLL_LIMIT_PER_MINUTE).every((s) => s === 200)).toBe(true);
        expect(demo.slice(DEMO_POLL_LIMIT_PER_MINUTE)).toEqual([429, 429, 429, 429, 429]);
        // Guessing ids is throttled the same way.
        await ctx.http().get('/api/demo/AAAAAAAAAAAAAAAAAAAAAA').expect(429);

        expect(HEALTH_LIMIT_PER_MINUTE).toBe(60);
        const health: number[] = [];
        for (let i = 0; i < HEALTH_LIMIT_PER_MINUTE + 3; i++) health.push((await ctx.http().get('/api/health')).status);
        expect(health.filter((s) => s === 200)).toHaveLength(HEALTH_LIMIT_PER_MINUTE);
        expect(health.slice(-3)).toEqual([429, 429, 429]);
      } finally {
        process.env.THROTTLE_DISABLED = 'true';
      }
    });
  });

  // ─── Item 6: no internal prompts in user responses ─────────────────────

  describe('internal prompts', () => {
    /** Every object key anywhere in a JSON value. */
    function allKeys(value: unknown, out = new Set<string>()): Set<string> {
      if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
      else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
          out.add(k);
          allKeys(v, out);
        }
      }
      return out;
    }

    it('[AC-SEC-015] no generation-related response contains prompts or the AI description (fixed key sets)', async () => {
      const { token } = await registerUser(ctx);
      const image = await uploadImage(ctx, token);
      ctx.gemini.failStyles.add('lifestyle-home');
      const start = await ctx
        .http()
        .post(`/api/generation/${image.id}/start`)
        .set(auth(token))
        .send({ styles: ['white-bg', 'lifestyle-home'] })
        .expect(201);
      await waitForGenerations(ctx, image.id);
      const custom = await ctx
        .http()
        .post(`/api/generation/${image.id}/custom`)
        .set(auth(token))
        .field('userPrompt', 'kubek na drewnianym stole')
        .expect(201);
      await waitForGenerations(ctx, image.id);
      const failed = await ctx.prisma.generation.findFirstOrThrow({ where: { imageId: image.id, status: 'FAILED' } });
      ctx.gemini.failStyles.clear();
      const retry = await ctx.http().post(`/api/generation/retry/${failed.id}`).set(auth(token)).expect(201);
      await waitForGenerations(ctx, image.id);

      // The database does hold the internal data – it just never leaves the API.
      const rows = await ctx.prisma.generation.findMany({ where: { imageId: image.id } });
      expect(rows.every((g) => g.prompt && g.prompt.length > 0)).toBe(true);
      expect((await ctx.prisma.image.findUniqueOrThrow({ where: { id: image.id } })).description).toBeTruthy();
      const secrets = [...rows.map((g) => g.prompt!), 'A red cube product'];

      const one = rows.find((g) => g.status === 'COMPLETED')!;
      const responses: Record<string, unknown> = {
        start: start.body,
        custom: custom.body,
        retry: retry.body,
        list: (await ctx.http().get('/api/images').set(auth(token)).expect(200)).body,
        image: (await ctx.http().get(`/api/images/${image.id}`).set(auth(token)).expect(200)).body,
        results: (await ctx.http().get(`/api/generation/${image.id}/results`).set(auth(token)).expect(200)).body,
        result: (await ctx.http().get(`/api/generation/result/${one.id}`).set(auth(token)).expect(200)).body,
      };
      for (const [name, body] of Object.entries(responses)) {
        const keys = allKeys(body);
        expect({ name, prompt: keys.has('prompt'), description: keys.has('description') }).toEqual({
          name,
          prompt: false,
          description: false,
        });
        const text = JSON.stringify(body);
        for (const secret of secrets) expect({ name, leaks: text.includes(secret) }).toEqual({ name, leaks: false });
      }

      // Snapshot of the generation shape the app may rely on.
      const userFields = [...USER_GENERATION_FIELDS].sort();
      const results = responses.results as Array<Record<string, unknown>>;
      expect(results).toHaveLength(3);
      for (const g of results) expect(Object.keys(g).sort()).toEqual(userFields);
      expect(Object.keys(responses.result as object).sort()).toEqual(userFields);
      for (const g of (responses.image as { generations: Array<Record<string, unknown>> }).generations) {
        expect(Object.keys(g).sort()).toEqual(userFields);
      }
      expect(Object.keys(responses.image as object).sort()).toEqual([
        'createdAt',
        'filename',
        'generations',
        'id',
        'originalUrl',
        'userId',
      ]);
      const listed = (responses.list as { images: Array<Record<string, any>> }).images[0];
      expect(Object.keys(listed).sort()).toEqual([
        'createdAt',
        'filename',
        'generations',
        'hasDescription',
        'id',
        'originalUrl',
        'userId',
      ]);
      for (const g of listed.generations)
        expect(Object.keys(g).sort()).toEqual(['createdAt', 'id', 'status', 'style', 'url']);
      expect(Object.keys(responses.start as object).sort()).toEqual(['count', 'generationIds', 'message', 'styles']);
      expect(Object.keys(responses.custom as object)).toEqual(['generationId']);
      expect(Object.keys(responses.retry as object).sort()).toEqual(['generationId', 'message']);
    });
  });

  // ─── Item 7: sender identification in every e-mail ─────────────────────

  describe('e-mail footer', () => {
    it('[AC-NOT-012] every template the app sends ends with company, address, NIP and contact equal to entity.ts', async () => {
      const legal = landingLegalEntity();
      const NOON = new Date('2026-10-20T10:00:00Z');

      // Verification + password reset.
      const user = await registerUser(ctx, uniqueEmail('stopka'));
      await ctx.http().post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
      // Free-credit reminder (marketing).
      await ctx.prisma.user.update({
        where: { id: user.userId },
        data: { createdAt: new Date(NOON.getTime() - 4 * DAY), marketingConsentAt: new Date() },
      });
      await notifications.runReminderJob(NOON);
      // Seasonal campaign (marketing).
      const christmas = getStyle('christmas')!;
      await notifications.runReminderJob(new Date(`2026-${christmas.season!.from}T10:00:00Z`));
      // Bulk upload finished (transactional).
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const image = await uploadImage(ctx, user.token);
        await ctx
          .http()
          .post(`/api/generation/${image.id}/start`)
          .set(auth(user.token))
          .send({ styles: ['white-bg'] })
          .expect(201);
        await waitForGenerations(ctx, image.id);
        ids.push(image.id);
      }
      await ctx.http().post('/api/notifications/batches').set(auth(user.token)).send({ imageIds: ids }).expect(201);
      await notifications.runBatchJob();
      // Message from the administrator.
      const admin = await registerUser(ctx, uniqueEmail('owner'));
      (ctx.app.get(AdminGuard) as any).admins = new Set([admin.email]);
      (ctx.app.get(UsersService) as any).admins = new Set([admin.email]);
      await ctx
        .http()
        .post(`/api/admin/users/${user.userId}/email`)
        .set(auth(admin.token))
        .send({ subject: 'Pytanie o grafiki', message: 'Dzień dobry, czy możemy pomóc?' })
        .expect(201);
      // Landing demo result.
      const demo = await ctx
        .http()
        .post('/api/demo')
        .field('email', 'stopka-demo@example.com')
        .attach('file', await makePng({ r: 7, g: 7, b: 7 }, 128), { filename: 'p.png', contentType: 'image/png' })
        .expect(201);
      await waitForDemo(demo.body.id);

      const subjects = ctx.mail.sent.map((m) => m.subject);
      for (const expected of [
        /potwierdź adres e-mail/,
        /resetowanie hasła/,
        /darmow.* czeka/,
        /styl „Boże Narodzenie/,
        /masowego przesyłania są gotowe/,
        /Pytanie o grafiki/,
        /próbna grafika jest gotowa/,
      ]) {
        expect(subjects.some((s) => expected.test(s))).toBe(true);
      }
      for (const mail of ctx.mail.sent) {
        for (const value of [legal.name, legal.address, `NIP ${legal.nip}`, legal.email]) {
          expect({ subject: mail.subject, text: mail.text.includes(value), html: mail.html?.includes(value) }).toEqual({
            subject: mail.subject,
            text: true,
            html: true,
          });
        }
        expect(mail.text.trim().split('\n').pop()).toContain(`NIP ${legal.nip}`);
      }
    });
  });

  // ─── Item 8: AI disclosure in exports ──────────────────────────────────

  describe('AI disclosure in exports', () => {
    it('[AC-EXP-022, AC-EXP-023] AI exports declare the IPTC digital source type in every format; the original never does', async () => {
      const { token } = await registerUser(ctx);
      const upload = await ctx
        .http()
        .post('/api/images/upload')
        .set(auth(token))
        .attach('file', await photoWithMetadata('jpeg'), { filename: 'IMG.jpg', contentType: 'image/jpeg' })
        .expect(201);
      await ctx
        .http()
        .post(`/api/generation/${upload.body.id}/start`)
        .set(auth(token))
        .send({ styles: ['white-bg'] })
        .expect(201);
      const [generation] = await waitForGenerations(ctx, upload.body.id);

      for (const format of ['jpeg', 'png', 'webp'] as const) {
        const ai = await ctx
          .http()
          .post(`/api/generation/export/${generation.id}`)
          .set(auth(token))
          .send({ format, ratio: '1:1', size: 600 })
          .expect(201);
        expect(ai.headers['content-type']).toBe(`image/${format}`);
        expect(await digitalSourceType(ai.body)).toBe(AI_DIGITAL_SOURCE_TYPE);
        expect((await sharp(ai.body).metadata()).exif).toBeUndefined();

        const original = await ctx
          .http()
          .post(`/api/generation/export-original/${upload.body.id}`)
          .set(auth(token))
          .send({ format, ratio: '1:1', size: 600 })
          .expect(201);
        const meta = await sharp(original.body).metadata();
        expect(meta.format).toBe(format);
        expect(await digitalSourceType(original.body)).toBeNull();
        expect([meta.xmp, meta.exif, hasGpsTag(meta.exif)]).toEqual([undefined, undefined, false]);
      }

      // With a platform preset too (the most common path in the app).
      const preset = await ctx
        .http()
        .post(`/api/generation/export/${generation.id}`)
        .set(auth(token))
        .send({ platform: 'ebay' })
        .expect(201);
      expect(await digitalSourceType(preset.body)).toBe(AI_DIGITAL_SOURCE_TYPE);
    });

    it('[AC-EXP-024] single download, every ZIP entry and infographics carry the marker; stored files stay untouched', async () => {
      const storage = ctx.app.get(StorageService);
      const { token } = await registerUser(ctx);
      const image = await uploadImage(ctx, token);
      await ctx
        .http()
        .post(`/api/generation/${image.id}/start`)
        .set(auth(token))
        .send({ styles: ['white-bg', 'lifestyle-home', 'dark-luxury'] })
        .expect(201);
      const generations = await waitForGenerations(ctx, image.id);
      expect(generations.every((g) => g.status === 'COMPLETED')).toBe(true);

      // Stored like graphics generated before the change: a plain PNG (from the fake AI), a JPEG and a
      // WebP that carries its own XMP.
      const base = sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 20, g: 90, b: 200 } } });
      await storage.replaceFile(generations[1].url!, await base.clone().jpeg().toBuffer(), 'image/jpeg');
      await storage.replaceFile(
        generations[2].url!,
        await base.clone().withXmp(AUTHOR_XMP).webp().toBuffer(),
        'image/webp',
      );
      const stored = await Promise.all(generations.map(async (g) => (await storage.getFileBuffer(g.url!)).buffer));
      expect(await Promise.all(stored.map((b) => digitalSourceType(b)))).toEqual([null, null, null]);

      const formats: string[] = [];
      for (const [i, generation] of generations.entries()) {
        const res = await ctx
          .http()
          .get(`/api/generation/download/${generation.id}`)
          .set(auth(token))
          .buffer(true)
          .parse(binaryParser)
          .expect(200);
        const body = res.body as Buffer;
        expect(await digitalSourceType(body)).toBe(AI_DIGITAL_SOURCE_TYPE);
        const meta = await sharp(body).metadata();
        formats.push(meta.format!);
        expect(meta.xmp!.toString('utf8')).not.toContain('Jan Kowalski');
        // PNG and JPEG: same pixels as the stored file (no re-encoding).
        if (meta.format !== 'webp') {
          expect((await sharp(body).raw().toBuffer()).equals(await sharp(stored[i]).raw().toBuffer())).toBe(true);
        }
      }
      expect(formats).toEqual(['png', 'jpeg', 'webp']);

      const zip = await ctx
        .http()
        .post('/api/generation/zip')
        .set(auth(token))
        .send({ imageIds: [image.id] })
        .buffer(true)
        .parse(binaryParser)
        .expect(201);
      const entries = [...(await readZip(zip.body as Buffer)).entries()].filter(([name]) => !name.endsWith('.txt'));
      expect(entries).toHaveLength(3);
      for (const [name, file] of entries) {
        expect({ name, type: await digitalSourceType(file) }).toEqual({ name, type: AI_DIGITAL_SOURCE_TYPE });
      }

      for (const format of ['png', 'jpeg'] as const) {
        const info = await ctx
          .http()
          .post(`/api/generation/infographic/${generations[0].id}`)
          .set(auth(token))
          .send({
            template: 'features',
            title: 'Kubek',
            features: [{ icon: 'shield', text: '2 lata gwarancji' }],
            format,
          })
          .buffer(true)
          .parse(binaryParser)
          .expect(201);
        expect((await sharp(info.body as Buffer).metadata()).format).toBe(format);
        expect(await digitalSourceType(info.body as Buffer)).toBe(AI_DIGITAL_SOURCE_TYPE);
      }

      // The files in storage are served marked, but never rewritten.
      for (const [i, g] of generations.entries()) {
        expect((await storage.getFileBuffer(g.url!)).buffer.equals(stored[i])).toBe(true);
      }
      // The seller's own photo stays unmarked (AC-EXP-023).
      const original = await storage.getFileBuffer(
        (await ctx.prisma.image.findUniqueOrThrow({ where: { id: image.id } })).filename,
      );
      expect(await digitalSourceType(original.buffer)).toBeNull();
    });
  });
});
