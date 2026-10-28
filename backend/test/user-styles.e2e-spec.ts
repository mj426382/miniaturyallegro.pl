import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import {
  createTestApp,
  getCredits,
  registerUser,
  resetDatabase,
  TestContext,
  uniqueEmail,
  uploadImage,
  waitFor,
  waitForGenerations,
} from './test-app';
import { makePng } from './fakes';
import { MAX_USER_STYLES } from '../src/generation/user-styles.dto';
import { StorageService } from '../src/images/storage.service';

/** Spec 27 (AC-UST-001..007): saved user styles and graphics generated from them. */
describe('saved user styles (integration)', () => {
  let ctx: TestContext;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const uploadsDir = () => process.env.LOCAL_UPLOAD_DIR!;
  const stored = (key: string) => fs.existsSync(path.join(uploadsDir(), key.replace(/^\/api\/uploads\//, '')));
  const styleRow = (id: string) => ctx.prisma.userStyle.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.gemini.failStyles.clear();
    ctx.gemini.failDescription = false;
    ctx.gemini.failPrompts = false;
    ctx.gemini.failAllImages = false;
    ctx.gemini.delayMs = 0;
  });

  function create(token: string, fields: { name?: string; prompt?: string }, reference?: Buffer, type = 'image/png') {
    const req = ctx.http().post('/api/user-styles').set(auth(token));
    if (fields.name !== undefined) req.field('name', fields.name);
    if (fields.prompt !== undefined) req.field('prompt', fields.prompt);
    if (reference) req.attach('reference', reference, { filename: 'wzor.png', contentType: type });
    return req;
  }

  function update(token: string, id: string, fields: Record<string, string>, reference?: Buffer) {
    const req = ctx.http().patch(`/api/user-styles/${id}`).set(auth(token));
    for (const [k, v] of Object.entries(fields)) req.field(k, v);
    if (reference) req.attach('reference', reference, { filename: 'nowy.png', contentType: 'image/png' });
    return req;
  }

  const generate = (token: string, imageId: string, styleId: string) =>
    ctx.http().post(`/api/generation/${imageId}/user-style/${styleId}`).set(auth(token));

  it('[AC-UST-001] saves a style with a compressed reference, lists the own styles newest first', async () => {
    const { token } = await registerUser(ctx);
    const other = await registerUser(ctx);
    const big = await makePng({ r: 200, g: 100, b: 50 }, 2000);

    const withRef = await create(
      token,
      { name: '  Kuchnia z kotem ', prompt: '  produkt na stole w kuchni, obok kot ' },
      big,
    ).expect(201);
    expect(withRef.body).toMatchObject({ name: 'Kuchnia z kotem', prompt: 'produkt na stole w kuchni, obok kot' });
    expect(withRef.body.referenceUrl).toContain('/api/uploads/user-styles/');
    expect(withRef.body).not.toHaveProperty('referenceKey');
    const row = await styleRow(withRef.body.id);
    expect(stored(row.referenceKey!)).toBe(true);
    const meta = await sharp(path.join(uploadsDir(), row.referenceKey!.replace(/^\/api\/uploads\//, ''))).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1024);

    const plain = await create(token, { name: 'Plener', prompt: 'na trawie w słońcu' }).expect(201);
    expect(plain.body.referenceUrl).toBeNull();
    await create(other.token, { name: 'Cudzy', prompt: 'styl innego konta' }).expect(201);

    const list = await ctx.http().get('/api/user-styles').set(auth(token)).expect(200);
    expect(list.body.map((s: any) => s.name)).toEqual(['Plener', 'Kuchnia z kotem']);
    await ctx.http().get('/api/user-styles').expect(401);
  });

  it('[AC-UST-002] rejects too short / too long names and descriptions and non-image files, storing nothing', async () => {
    const { token, userId } = await registerUser(ctx);
    const png = await makePng(undefined, 512);
    const cases: [Record<string, string>, Buffer | undefined, string?][] = [
      [{ name: 'a', prompt: 'poprawny opis' }, png],
      [{ name: 'x'.repeat(61), prompt: 'poprawny opis' }, png],
      [{ name: 'Dobra nazwa', prompt: 'ab' }, png],
      [{ name: 'Dobra nazwa', prompt: 'y'.repeat(501) }, png],
      [{ prompt: 'brak nazwy' }, png],
      [{ name: 'Plik tekstowy', prompt: 'poprawny opis' }, Buffer.from('not an image at all'), 'image/png'],
      [{ name: 'PDF', prompt: 'poprawny opis' }, Buffer.from('%PDF-1.4'), 'application/pdf'],
    ];
    const before = fs.existsSync(path.join(uploadsDir(), 'user-styles'))
      ? fs.readdirSync(path.join(uploadsDir(), 'user-styles')).length
      : 0;
    for (const [fields, file, type] of cases) {
      const res = await create(token, fields, file, type ?? 'image/png');
      expect([400, 415]).toContain(res.status);
    }
    expect(await ctx.prisma.userStyle.count({ where: { userId } })).toBe(0);
    const after = fs.existsSync(path.join(uploadsDir(), 'user-styles'))
      ? fs.readdirSync(path.join(uploadsDir(), 'user-styles')).length
      : 0;
    expect(after).toBe(before);
  });

  it('[AC-UST-003] names are unique per account regardless of case; at most 20 styles', async () => {
    const { token, userId } = await registerUser(ctx);
    const other = await registerUser(ctx);
    await create(token, { name: 'Kuchnia', prompt: 'jasna kuchnia' }).expect(201);
    const dup = await create(token, { name: 'kuchnia', prompt: 'inny opis' }).expect(409);
    expect(dup.body.message).toBe('Masz już styl o tej nazwie.');
    await create(other.token, { name: 'KUCHNIA', prompt: 'to samo w innym koncie' }).expect(201);

    const second = await create(token, { name: 'Ogród', prompt: 'zielony ogród' }).expect(201);
    await update(token, second.body.id, { name: 'KUCHNIA' }).expect(409);
    await update(token, second.body.id, { name: 'Ogród' }).expect(200); // own name, unchanged

    await ctx.prisma.userStyle.createMany({
      data: Array.from({ length: MAX_USER_STYLES - 2 }, (_, i) => ({ userId, name: `Styl ${i}`, prompt: 'opis' })),
    });
    const dir = path.join(uploadsDir(), 'user-styles');
    const filesBefore = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
    const limit = await create(
      token,
      { name: 'Dwudziesty pierwszy', prompt: 'za dużo' },
      await makePng(undefined, 512),
    ).expect(409);
    expect(limit.body.message).toContain('najwyżej 20 stylów');
    expect(fs.existsSync(dir) ? fs.readdirSync(dir).length : 0).toBe(filesBefore);
    expect(await ctx.prisma.userStyle.count({ where: { userId } })).toBe(MAX_USER_STYLES);
  });

  it('[AC-UST-004] edits name/description, replaces and removes the photo; foreign or missing styles are 404', async () => {
    const { token } = await registerUser(ctx);
    const intruder = await registerUser(ctx);
    const style = (
      await create(token, { name: 'Stół', prompt: 'drewniany stół' }, await makePng({ r: 1, g: 1, b: 1 }, 512)).expect(
        201,
      )
    ).body;
    const firstKey = (await styleRow(style.id)).referenceKey!;

    const renamed = await update(token, style.id, {
      name: 'Stół dębowy',
      prompt: 'dębowy stół, ciepłe światło',
    }).expect(200);
    expect(renamed.body).toMatchObject({ name: 'Stół dębowy', prompt: 'dębowy stół, ciepłe światło' });
    expect((await styleRow(style.id)).referenceKey).toBe(firstKey);

    await update(token, style.id, {}, await makePng({ r: 9, g: 9, b: 9 }, 512)).expect(200);
    const secondKey = (await styleRow(style.id)).referenceKey!;
    expect(secondKey).not.toBe(firstKey);
    expect(stored(firstKey)).toBe(false);
    expect(stored(secondKey)).toBe(true);

    const removed = await update(token, style.id, { removeReference: 'true' }).expect(200);
    expect(removed.body.referenceUrl).toBeNull();
    expect(stored(secondKey)).toBe(false);

    const image = await uploadImage(ctx, intruder.token);
    await update(intruder.token, style.id, { name: 'Przejęty' }).expect(404);
    await ctx.http().delete(`/api/user-styles/${style.id}`).set(auth(intruder.token)).expect(404);
    await generate(intruder.token, image.id, style.id).expect(404);
    await update(token, 'nie-ma-takiego', { name: 'X1' }).expect(404);
    expect((await styleRow(style.id)).name).toBe('Stół dębowy');
  });

  it('[AC-UST-005] deleting a style removes it and its photo but keeps graphics; deleting the account removes all styles', async () => {
    const email = uniqueEmail();
    const { token, userId } = await registerUser(ctx, email);
    const image = await uploadImage(ctx, token);
    const style = (
      await create(token, { name: 'Kot', prompt: 'obok produktu siedzi kot' }, await makePng(undefined, 512)).expect(
        201,
      )
    ).body;
    const key = (await styleRow(style.id)).referenceKey!;
    const gen = (await generate(token, image.id, style.id).expect(201)).body.generationId;
    await waitForGenerations(ctx, image.id);

    await ctx.http().delete(`/api/user-styles/${style.id}`).set(auth(token)).expect(200, { ok: true });
    expect(await ctx.prisma.userStyle.count({ where: { userId } })).toBe(0);
    expect(stored(key)).toBe(false);
    expect(await ctx.prisma.generation.findUniqueOrThrow({ where: { id: gen } })).toMatchObject({
      status: 'COMPLETED',
      styleLabel: 'Kot',
    });

    const kept = (
      await create(token, { name: 'Pies', prompt: 'pies obok produktu' }, await makePng(undefined, 512)).expect(201)
    ).body;
    const keptKey = (await styleRow(kept.id)).referenceKey!;
    await ctx.http().delete('/api/users/me').set(auth(token)).send({ confirmEmail: email }).expect(200);
    expect(await ctx.prisma.userStyle.count()).toBe(0);
    expect(stored(keptKey)).toBe(false);
  });

  it('[AC-UST-006] a saved style makes one custom graphic for 1 credit with a copy of its photo; 402 without credits', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    const style = (
      await create(
        token,
        { name: 'Kuchnia z kotem', prompt: 'jasna kuchnia, obok kot' },
        await makePng(undefined, 512),
      ).expect(201)
    ).body;
    const styleKey = (await styleRow(style.id)).referenceKey!;
    const before = await getCredits(ctx, userId);

    ctx.gemini.delayMs = 300;
    const { generationId } = (await generate(token, image.id, style.id).expect(201)).body;
    const pending = await ctx.prisma.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(pending).toMatchObject({ style: 'custom', styleLabel: 'Kuchnia z kotem', isRework: false });
    expect(pending.referenceKey).toContain('references/');
    expect(pending.referenceKey).not.toBe(styleKey);
    expect(stored(pending.referenceKey!)).toBe(true);
    expect(await getCredits(ctx, userId)).toEqual({ ...before, freeCreditsUsed: before.freeCreditsUsed + 1 });

    const rows = await waitForGenerations(ctx, image.id);
    expect(rows[0]).toMatchObject({
      status: 'COMPLETED',
      prompt: 'custom:jasna kuchnia, obok kot',
      referenceKey: null,
    });
    expect(ctx.gemini.lastCustomOptions).toEqual({ hasStyleReference: true });
    expect(stored(pending.referenceKey!)).toBe(false);
    expect(stored(styleKey)).toBe(true);

    const results = await ctx.http().get(`/api/generation/${image.id}/results`).set(auth(token)).expect(200);
    expect(results.body[0]).toMatchObject({ styleLabel: 'Kuchnia z kotem', style: 'custom' });
    expect(results.body[0]).not.toHaveProperty('prompt');

    // A style without a photo generates without a reference.
    const plain = (await create(token, { name: 'Plener', prompt: 'trawa i słońce' }).expect(201)).body;
    const second = (await generate(token, image.id, plain.id).expect(201)).body.generationId;
    await waitFor(
      async () => (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: second } })).status === 'COMPLETED',
    );
    expect(ctx.gemini.lastCustomOptions).toEqual({ hasStyleReference: false });

    // No credits: 402, no row, no copied file.
    await ctx.prisma.user.update({ where: { id: userId }, data: { freeCreditsUsed: 1000, credits: 0 } });
    const count = await ctx.prisma.generation.count();
    const refs = fs.readdirSync(path.join(uploadsDir(), 'references')).length;
    await generate(token, image.id, style.id).expect(402);
    expect(await ctx.prisma.generation.count()).toBe(count);
    expect(fs.readdirSync(path.join(uploadsDir(), 'references')).length).toBe(refs);
  });

  it('[AC-UST-006] the photo reaches the image model with an image type even when the storage returns a generic one', async () => {
    const { token } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    const style = (
      await create(token, { name: 'Wzór PNG', prompt: 'jasne tło z roślinami' }, await makePng(undefined, 512)).expect(
        201,
      )
    ).body;
    const storage = ctx.app.get(StorageService);
    const real = storage.getFileBuffer.bind(storage);
    const key = (await styleRow(style.id)).referenceKey!;
    jest.spyOn(storage, 'getFileBuffer').mockImplementation(async (k: string) => {
      const file = await real(k);
      return k === key ? { buffer: file.buffer, contentType: 'application/octet-stream' } : file;
    });
    try {
      const { generationId } = (await generate(token, image.id, style.id).expect(201)).body;
      const copy = (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: generationId } })).referenceKey!;
      // The stored style photo is compressed (JPEG/PNG/WebP) – the copy keeps its format.
      expect(path.extname(copy)).toBe(path.extname(key));
      await waitFor(
        async () =>
          (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: generationId } })).status === 'COMPLETED',
      );
      const expected = { '.png': 'image/png', '.webp': 'image/webp' }[path.extname(key)] ?? 'image/jpeg';
      expect(ctx.gemini.lastReferenceMime).toBe(expected);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('[AC-UST-007] a retry uses the description and photo copy from the start, even after the style changed or was deleted', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    const style = (
      await create(
        token,
        { name: 'Pies FAILME', prompt: 'pies FAILME obok produktu' },
        await makePng(undefined, 512),
      ).expect(201)
    ).body;
    ctx.gemini.failStyles = new Set(['FAILME']);
    const before = await getCredits(ctx, userId);
    const { generationId } = (await generate(token, image.id, style.id).expect(201)).body;
    await waitFor(
      async () => (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: generationId } })).status === 'FAILED',
    );
    expect(await getCredits(ctx, userId)).toEqual(before);
    const copy = (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: generationId } })).referenceKey!;

    await update(token, style.id, { name: 'Zmieniony', prompt: 'zupełnie inna scena' }).expect(200);
    await ctx.http().delete(`/api/user-styles/${style.id}`).set(auth(token)).expect(200);
    expect(stored(copy)).toBe(true);

    ctx.gemini.failStyles.clear();
    await ctx.http().post(`/api/generation/retry/${generationId}`).set(auth(token)).expect(201);
    await waitFor(
      async () =>
        (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: generationId } })).status === 'COMPLETED',
    );
    const done = await ctx.prisma.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(done).toMatchObject({
      prompt: 'custom:pies FAILME obok produktu',
      styleLabel: 'Pies FAILME',
      referenceKey: null,
    });
    expect(ctx.gemini.lastCustomOptions).toEqual({ hasStyleReference: true });
    expect(stored(copy)).toBe(false);
    expect(await getCredits(ctx, userId)).toEqual({ ...before, freeCreditsUsed: before.freeCreditsUsed + 1 });
  });
});
