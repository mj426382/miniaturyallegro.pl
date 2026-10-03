import { createTestApp, registerUser, resetDatabase, TestContext, uploadImage } from './test-app';
import { makeJpeg } from './fakes';

describe('Images (integration)', () => {
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

  it('[AC-UPL-001] uploads a valid image and lists it', async () => {
    const { token } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    expect(image.id).toEqual(expect.any(String));
    expect(image.originalUrl).toContain('/api/uploads/originals/');
    expect(image).not.toHaveProperty('description');

    const list = await ctx.http().get('/api/images').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.pagination.total).toBe(1);
    expect(list.body.images[0].id).toBe(image.id);
  });

  it('accepts JPEG and derives the extension from the real format, not the file name', async () => {
    const { token } = await registerUser(ctx);
    const jpeg = await makeJpeg();
    const res = await ctx
      .http()
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpeg, { filename: 'evil.html', contentType: 'image/png' })
      .expect(201);
    expect(res.body.filename).toMatch(/\.jpg$/);
  });

  it('[AC-UPL-002] rejects files that are not real images even with an image MIME type', async () => {
    const { token } = await registerUser(ctx);
    await ctx
      .http()
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), {
        filename: 'x.png',
        contentType: 'image/png',
      })
      .expect(400);

    await ctx
      .http()
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'x.pdf', contentType: 'application/pdf' })
      .expect(400);
  });

  it('[AC-UPL-003] requires a file', async () => {
    const { token } = await registerUser(ctx);
    await ctx.http().post('/api/images/upload').set('Authorization', `Bearer ${token}`).expect(400);
  });

  it('[AC-UPL-004] prevents access to other users images', async () => {
    const owner = await registerUser(ctx);
    const other = await registerUser(ctx);
    const image = await uploadImage(ctx, owner.token);

    await ctx.http().get(`/api/images/${image.id}`).set('Authorization', `Bearer ${other.token}`).expect(403);
    await ctx.http().delete(`/api/images/${image.id}`).set('Authorization', `Bearer ${other.token}`).expect(403);
    await ctx
      .http()
      .get(`/api/generation/${image.id}/results`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(403);
    await ctx.http().get('/api/images/does-not-exist').set('Authorization', `Bearer ${other.token}`).expect(404);
  });

  it('[AC-UPL-005] deletes an image together with its generations', async () => {
    const { token } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    await ctx.prisma.generation.create({ data: { imageId: image.id, style: 'white-bg', status: 'COMPLETED' } });

    await ctx.http().delete(`/api/images/${image.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(await ctx.prisma.image.findUnique({ where: { id: image.id } })).toBeNull();
    expect(await ctx.prisma.generation.count({ where: { imageId: image.id } })).toBe(0);
  });

  it('clamps pagination parameters', async () => {
    const { token } = await registerUser(ctx);
    const res = await ctx
      .http()
      .get('/api/images?page=0&limit=1000')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 50 });
  });
});
