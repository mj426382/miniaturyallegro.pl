import sharp from 'sharp';
import * as yauzl from 'yauzl';
import {
  createTestApp,
  getCredits,
  registerUser,
  resetDatabase,
  TestContext,
  uploadImage,
  waitForGenerations,
} from './test-app';
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

describe('Infographics & ZIP packages (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function photoWithGraphics(token: string, styles: string[]) {
    const image = await uploadImage(ctx, token);
    await ctx.http().post(`/api/generation/${image.id}/start`).set(auth(token)).send({ styles }).expect(201);
    const generations = await waitForGenerations(ctx, image.id);
    return { image, generations };
  }

  describe('infographics', () => {
    it('[AC-INF-001, AC-INF-002, AC-PRC-008] renders both templates for free', async () => {
      const { token, userId } = await registerUser(ctx);
      const { generations } = await photoWithGraphics(token, ['white-bg']);
      const before = await getCredits(ctx, userId);

      const icons = await ctx.http().get('/api/generation/infographic-icons').set(auth(token)).expect(200);
      expect(icons.body).toHaveLength(20);
      expect(icons.body[0]).toEqual({ id: 'check', name: 'Zaleta' });

      const features = await ctx
        .http()
        .post(`/api/generation/infographic/${generations[0].id}`)
        .set(auth(token))
        .send({ template: 'features', title: 'Kubek 450 ml', features: [{ icon: 'shield', text: '2 lata gwarancji' }] })
        .buffer(true)
        .parse(binaryParser)
        .expect(201);
      expect(features.headers['content-type']).toContain('image/png');
      expect(features.headers['content-disposition']).toContain('infografika-features-white-bg.png');
      const meta = await sharp(features.body as Buffer).metadata();
      expect([meta.width, meta.height]).toEqual([1600, 1600]);

      const dims = await ctx
        .http()
        .post(`/api/generation/infographic/${generations[0].id}`)
        .set(auth(token))
        .send({ template: 'dimensions', dimensions: { width: 9.5, height: 22, unit: 'cm' }, format: 'jpeg' })
        .buffer(true)
        .parse(binaryParser)
        .expect(201);
      expect(dims.headers['content-type']).toContain('image/jpeg');

      expect(await getCredits(ctx, userId)).toEqual(before);
    });

    it('[AC-INF-005] validates the request with Polish messages', async () => {
      const { token } = await registerUser(ctx);
      const { generations } = await photoWithGraphics(token, ['white-bg']);
      const post = (body: object) =>
        ctx.http().post(`/api/generation/infographic/${generations[0].id}`).set(auth(token)).send(body);

      const tooMany = await post({
        template: 'features',
        features: Array.from({ length: 7 }, () => ({ icon: 'check', text: 'x' })),
      }).expect(400);
      expect(JSON.stringify(tooMany.body.message)).toContain('Dodaj od 1 do 6 cech');
      await post({ template: 'features', features: [] }).expect(400);
      await post({ template: 'features', features: [{ icon: 'unicorn', text: 'x' }] }).expect(400);
      await post({ template: 'features', features: [{ icon: 'check', text: 'x'.repeat(49) }] }).expect(400);
      await post({ template: 'dimensions', dimensions: { width: 0, unit: 'cm' } }).expect(400);
      await post({ template: 'dimensions', dimensions: { width: 3, unit: 'inch' } }).expect(400);
      const missing = await post({ template: 'dimensions', dimensions: { depth: 3, unit: 'cm' } }).expect(400);
      expect(missing.body.message).toBe('Podaj co najmniej szerokość albo wysokość');
    });

    it('[AC-INF-006] refuses other users, unknown and unfinished graphics', async () => {
      const owner = await registerUser(ctx);
      const other = await registerUser(ctx);
      const { image, generations } = await photoWithGraphics(owner.token, ['white-bg']);
      const body = { template: 'features', features: [{ icon: 'check', text: 'ok' }] };

      await ctx
        .http()
        .post(`/api/generation/infographic/${generations[0].id}`)
        .set(auth(other.token))
        .send(body)
        .expect(403);
      await ctx.http().post('/api/generation/infographic/nope').set(auth(owner.token)).send(body).expect(404);
      const pending = await ctx.prisma.generation.create({
        data: { imageId: image.id, style: 'gradient-bg', status: 'PROCESSING' },
      });
      await ctx.http().post(`/api/generation/infographic/${pending.id}`).set(auth(owner.token)).send(body).expect(400);
    });
  });

  describe('ZIP', () => {
    it('[AC-BAT-001, AC-PRC-008] packs finished graphics per photo plus descriptions, for free', async () => {
      const { token, userId } = await registerUser(ctx);
      const first = await photoWithGraphics(token, ['white-bg', 'dark-luxury']);
      const second = await photoWithGraphics(token, ['gradient-bg']);
      await ctx.prisma.offerDescription.create({
        data: {
          imageId: second.image.id,
          title: 'Kubek ceramiczny 350 ml',
          body: '<h2>Najważniejsze cechy</h2><ul><li>pojemność 350 ml</li></ul>',
          keywords: ['kubek', 'kubek ceramiczny'],
        },
      });
      // an unfinished graphic is not packed
      await ctx.prisma.generation.create({ data: { imageId: first.image.id, style: 'in-action', status: 'FAILED' } });
      const before = await getCredits(ctx, userId);

      const res = await ctx
        .http()
        .post('/api/generation/zip')
        .set(auth(token))
        .send({ imageIds: [second.image.id, first.image.id] })
        .buffer(true)
        .parse(binaryParser)
        .expect(201);
      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="allgrafika-\d{4}-\d{2}-\d{2}\.zip"/);

      const files = await readZip(res.body as Buffer);
      const names = [...files.keys()];
      const f1 = `01-${second.image.id.slice(-8)}`;
      const f2 = `02-${first.image.id.slice(-8)}`;
      expect(names).toEqual([
        `${f1}/01-gradient-bg.png`,
        `${f1}/opis.html`,
        `${f1}/opis.txt`,
        `${f2}/01-white-bg.png`,
        `${f2}/02-dark-luxury.png`,
      ]);
      expect((await sharp(files.get(`${f2}/01-white-bg.png`)!).metadata()).format).toBe('png');
      expect(files.get(`${f1}/opis.html`)!.toString('utf8')).toContain('<li>pojemność 350 ml</li>');
      const txt = files.get(`${f1}/opis.txt`)!.toString('utf8');
      expect(txt).toContain('Tytuł: Kubek ceramiczny 350 ml');
      expect(txt).toContain('Frazy: kubek, kubek ceramiczny');
      expect(txt).toContain('pojemność 350 ml');
      expect(await getCredits(ctx, userId)).toEqual(before);
    });

    it('[AC-BAT-002] validates the selection and never reveals other users photos', async () => {
      const owner = await registerUser(ctx);
      const other = await registerUser(ctx);
      const mine = await photoWithGraphics(owner.token, ['white-bg']);
      const theirs = await photoWithGraphics(other.token, ['white-bg']);
      const zip = (imageIds: unknown) =>
        ctx.http().post('/api/generation/zip').set(auth(owner.token)).send({ imageIds });

      await zip([mine.image.id, theirs.image.id]).expect(404);
      await zip([]).expect(400);
      await zip([mine.image.id, mine.image.id]).expect(400);
      await zip(Array.from({ length: 51 }, (_, i) => `id-${i}`)).expect(400);

      const empty = await uploadImage(ctx, owner.token);
      const res = await zip([empty.id]).expect(404);
      expect(res.body.message).toContain('nie mają jeszcze gotowych grafik');
    });

    it('[AC-BAT-003] skips a file missing in storage and lists it in BLEDY.txt', async () => {
      const { token } = await registerUser(ctx);
      const { image, generations } = await photoWithGraphics(token, ['white-bg', 'dark-luxury']);
      const storage = ctx.app.get(StorageService);
      const lost = generations.find((g) => g.style === 'dark-luxury')!;
      await storage.deleteFile(lost.url!);

      const res = await ctx
        .http()
        .post('/api/generation/zip')
        .set(auth(token))
        .send({ imageIds: [image.id] })
        .buffer(true)
        .parse(binaryParser)
        .expect(201);
      const files = await readZip(res.body as Buffer);
      const folder = `01-${image.id.slice(-8)}`;
      expect([...files.keys()]).toEqual([`${folder}/01-white-bg.png`, 'BLEDY.txt']);
      expect(files.get('BLEDY.txt')!.toString('utf8')).toContain(`${folder}/02-dark-luxury.png`);
    });
  });
});
