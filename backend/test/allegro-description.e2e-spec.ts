import { createTestApp, registerUser, resetDatabase, TestContext, uploadImage } from './test-app';
import { AllegroService } from '../src/allegro/allegro.service';
import { encrypt } from '../src/common/crypto';

/** Spec 08 – publishing the offer copy (title + description) to an Allegro offer. */
describe('Allegro: publishing the offer description (integration)', () => {
  let ctx: TestContext;
  let allegro: AllegroService;
  let calls: Array<{ method: string; url: string; body?: any }>;
  let offer: any;
  let patchError: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    allegro = ctx.app.get(AllegroService);
    (allegro as any).clientId = 'client';
    (allegro as any).clientSecret = 'secret';
    allegro.setHttpClient({
      get: async (url: string) => {
        calls.push({ method: 'get', url });
        if (url.includes('/sale/product-offers/')) return { data: offer };
        throw new Error('unexpected get ' + url);
      },
      patch: async (url: string, body: any) => {
        calls.push({ method: 'patch', url, body });
        if (patchError) throw patchError;
        return { data: {} };
      },
      post: async (url: string) => {
        throw new Error('unexpected post ' + url);
      },
    } as any);
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    calls = [];
    patchError = null;
    offer = {
      id: '777',
      name: 'Stary tytuł',
      description: {
        sections: [
          { items: [{ type: 'IMAGE', url: 'https://a.allegroimg.com/original/x.jpg' }] },
          { items: [{ type: 'TEXT', content: '<p>Stary opis</p>' }] },
        ],
      },
    };
  });
  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function connectedUserWithDescription() {
    const user = await registerUser(ctx);
    const key = (allegro as any).key as Buffer;
    await ctx.prisma.allegroConnection.create({
      data: {
        userId: user.userId,
        accessTokenEncrypted: encrypt('acc', key),
        refreshTokenEncrypted: encrypt('ref', key),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const image = await uploadImage(ctx, user.token);
    await ctx.prisma.offerDescription.create({
      data: {
        imageId: image.id,
        title: 'Kubek termiczny 450 ml stalowy',
        body: '<h2>Najważniejsze cechy</h2><ul><li>450 ml</li></ul>',
      },
    });
    return { ...user, imageId: image.id };
  }

  it('[AC-ALG-007] replaces the whole description and the title', async () => {
    const { token, imageId } = await connectedUserWithDescription();
    const res = await ctx
      .http()
      .post('/api/allegro/offers/777/description')
      .set(auth(token))
      .send({ imageId, mode: 'replace', updateTitle: true })
      .expect(201);
    expect(res.body).toEqual({ offerId: '777', mode: 'replace', titleUpdated: true, sections: 1 });

    expect(calls.filter((c) => c.method === 'get')).toHaveLength(0);
    const patch = calls.find((c) => c.method === 'patch')!;
    expect(patch.url).toBe('https://api.allegro.pl/sale/product-offers/777');
    expect(patch.body).toEqual({
      name: 'Kubek termiczny 450 ml stalowy',
      description: {
        sections: [{ items: [{ type: 'TEXT', content: '<h2>Najważniejsze cechy</h2><ul><li>450 ml</li></ul>' }] }],
      },
    });
  });

  it('[AC-ALG-008] prepends our section, keeps the existing ones and leaves the title alone', async () => {
    const { token, imageId } = await connectedUserWithDescription();
    await ctx
      .http()
      .post('/api/allegro/offers/777/description')
      .set(auth(token))
      .send({ imageId, mode: 'prepend' })
      .expect(201);
    const patch = calls.find((c) => c.method === 'patch')!;
    expect(patch.body).not.toHaveProperty('name');
    expect(patch.body.description.sections).toEqual([
      { items: [{ type: 'TEXT', content: '<h2>Najważniejsze cechy</h2><ul><li>450 ml</li></ul>' }] },
      ...offer.description.sections,
    ]);

    offer.description.sections = Array.from({ length: 100 }, () => ({
      items: [{ type: 'TEXT', content: '<p>x</p>' }],
    }));
    calls = [];
    const full = await ctx
      .http()
      .post('/api/allegro/offers/777/description')
      .set(auth(token))
      .send({ imageId, mode: 'prepend' })
      .expect(400);
    expect(full.body.message).toContain('Zastąp opis');
    expect(calls.filter((c) => c.method === 'patch')).toHaveLength(0);
  });

  it('[AC-ALG-009] refuses photos without a description or of another user and relays Allegro errors', async () => {
    const { token, imageId } = await connectedUserWithDescription();
    const other = await registerUser(ctx);
    const bare = await uploadImage(ctx, token);

    await ctx
      .http()
      .post('/api/allegro/offers/777/description')
      .set(auth(token))
      .send({ imageId: bare.id, mode: 'replace' })
      .expect(404);
    await ctx
      .http()
      .post('/api/allegro/offers/777/description')
      .set(auth(other.token))
      .send({ imageId, mode: 'replace' })
      .expect(404);
    await ctx
      .http()
      .post('/api/allegro/offers/777/description')
      .set(auth(token))
      .send({ imageId, mode: 'append' })
      .expect(400);
    expect(calls).toHaveLength(0);

    patchError = {
      message: 'Request failed with status code 422',
      response: { status: 422, data: { errors: [{ userMessage: 'Tytuł zawiera niedozwolone słowo.' }] } },
    };
    const rejected = await ctx
      .http()
      .post('/api/allegro/offers/777/description')
      .set(auth(token))
      .send({ imageId, mode: 'replace', updateTitle: true })
      .expect(400);
    expect(rejected.body.message).toBe('Tytuł zawiera niedozwolone słowo.');
  });
});
