import {
  createTestApp,
  resetDatabase,
  registerUser,
  uploadImage,
  waitForGenerations,
  getCredits,
  TestContext,
} from './test-app';

/**
 * Offer copy (SEO description) attached to an uploaded photo: available only after a finished
 * graphic, free as a bonus, with 5 free AI rewrites per photo; further packs of 15 cost one credit.
 * Manual edits are unlimited.
 */
describe('Offer descriptions (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.gemini.failOfferCopy = false;
    ctx.gemini.calls = { description: 0, prompts: 0, image: 0, custom: 0, rework: 0, offerCopy: 0 };
  });
  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function imageWithGraphic(token: string) {
    const image = await uploadImage(ctx, token);
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set(auth(token))
      .send({ styles: ['white-bg'] })
      .expect(201);
    await waitForGenerations(ctx, image.id);
    return image;
  }

  it('[AC-DESC-001, AC-PRC-006] requires a finished graphic, then writes the copy for free and sanitizes it', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);

    const before = await ctx.http().get(`/api/descriptions/${image.id}`).set(auth(token)).expect(200);
    expect(before.body).toMatchObject({
      description: null,
      canCreate: false,
      promptEditsLimit: 5,
      promptEditsLeft: 5,
      creditCost: 0,
      editPackSize: 15,
      editPackCredits: 1,
    });

    await ctx.http().post(`/api/descriptions/${image.id}`).set(auth(token)).send({ notes: 'kubek 350 ml' }).expect(409);

    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set(auth(token))
      .send({ styles: ['white-bg'] })
      .expect(201);
    await waitForGenerations(ctx, image.id);
    expect((await getCredits(ctx, userId)).freeCreditsUsed).toBe(1);

    const created = await ctx
      .http()
      .post(`/api/descriptions/${image.id}`)
      .set(auth(token))
      .send({ notes: '  kubek 350 ml  ' })
      .expect(201);
    expect(created.body.description.title).toBe('Kubek ceramiczny 350 ml – kubek 350 ml');
    // Only Allegro's tags survive; script/attributes are gone, h1/strong are mapped.
    expect(created.body.description.body).toBe(
      '<h2>Kubek ceramiczny</h2><p>Solidny kubek <b>350 ml</b> do codziennego użytku, zmywarka OK.</p>' +
        '<h2>Najważniejsze cechy</h2><ul><li>pojemność 350 ml</li><li>szkliwo</li></ul>',
    );
    expect(created.body.description.keywords).toEqual(['kubek ceramiczny', 'kubek 350 ml']);
    expect(created.body.description.sellerNotes).toBe('kubek 350 ml');
    expect(created.body).toMatchObject({ canCreate: true, promptEditsLeft: 5 });
    // The first description is a bonus – only the graphic was charged.
    expect((await getCredits(ctx, userId)).freeCreditsUsed).toBe(1);
    // The cached English product analysis is handed to the copywriter prompt.
    expect(ctx.gemini.lastOfferCopyInput?.productAnalysis).toContain('red cube');

    const fetched = await ctx.http().get(`/api/descriptions/${image.id}`).set(auth(token)).expect(200);
    expect(fetched.body.description.title).toBe(created.body.description.title);

    // The gallery list flags the photo as described without shipping the copy itself.
    const list = await ctx.http().get('/api/images').set(auth(token)).expect(200);
    const listed = list.body.images.find((i: any) => i.id === image.id);
    expect(listed.hasDescription).toBe(true);
    expect(listed.offerDescription).toBeUndefined();
  });

  it('[AC-DESC-002] does not create anything when the model fails', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await imageWithGraphic(token);
    ctx.gemini.failOfferCopy = true;

    await ctx.http().post(`/api/descriptions/${image.id}`).set(auth(token)).send({}).expect(503);
    expect((await getCredits(ctx, userId)).freeCreditsUsed).toBe(1);
    expect(await ctx.prisma.offerDescription.findUnique({ where: { imageId: image.id } })).toBeNull();
  });

  it('[AC-DESC-003, AC-PRC-007] gives five free AI rewrites, sells packs of fifteen for a credit and counts "write again" as a rewrite', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await imageWithGraphic(token);
    await ctx.http().post(`/api/descriptions/${image.id}`).set(auth(token)).send({ notes: 'kubek' }).expect(201);

    // A failed rewrite is not counted.
    ctx.gemini.failOfferCopy = true;
    await ctx
      .http()
      .post(`/api/descriptions/${image.id}/refine`)
      .set(auth(token))
      .send({ instruction: 'krócej' })
      .expect(503);
    ctx.gemini.failOfferCopy = false;

    let last: any;
    for (let i = 1; i <= 4; i++) {
      last = await ctx
        .http()
        .post(`/api/descriptions/${image.id}/refine`)
        .set(auth(token))
        .send({ instruction: `zmiana ${i}` })
        .expect(201);
      expect(last.body.promptEditsLeft).toBe(5 - i);
    }
    expect(last.body.description.title).toContain('(poprawiony)');
    expect(last.body.description.body).toContain('<p>Poprawka: zmiana 4</p>');

    // Writing again from scratch spends the fifth free rewrite.
    const again = await ctx
      .http()
      .post(`/api/descriptions/${image.id}`)
      .set(auth(token))
      .send({ notes: 'inny kubek' })
      .expect(201);
    expect(again.body.promptEditsLeft).toBe(0);
    expect(again.body.description.sellerNotes).toBe('inny kubek');

    // Out of rewrites: 402 with a hint to buy a pack; nothing was charged so far beyond the graphic.
    const refused = await ctx
      .http()
      .post(`/api/descriptions/${image.id}/refine`)
      .set(auth(token))
      .send({ instruction: 'jeszcze' })
      .expect(402);
    expect(refused.body.code).toBe('EDIT_PACK_REQUIRED');
    await ctx.http().post(`/api/descriptions/${image.id}`).set(auth(token)).send({}).expect(402);
    expect((await getCredits(ctx, userId)).freeCreditsUsed).toBe(1);

    // Buy a pack: one credit, fifteen more rewrites.
    const bought = await ctx.http().post(`/api/descriptions/${image.id}/edit-packs`).set(auth(token)).expect(201);
    expect(bought.body).toMatchObject({ promptEditsLimit: 20, promptEditsLeft: 15 });
    expect((await getCredits(ctx, userId)).freeCreditsUsed).toBe(2);
    const afterPack = await ctx
      .http()
      .post(`/api/descriptions/${image.id}/refine`)
      .set(auth(token))
      .send({ instruction: 'po pakiecie' })
      .expect(201);
    expect(afterPack.body.promptEditsLeft).toBe(14);

    // Packs stack, and buying one needs a credit.
    await ctx.http().post(`/api/descriptions/${image.id}/edit-packs`).set(auth(token)).expect(201);
    expect(
      (await ctx.http().get(`/api/descriptions/${image.id}`).set(auth(token)).expect(200)).body.promptEditsLimit,
    ).toBe(35);
    await ctx.prisma.user.update({ where: { id: userId }, data: { freeCreditsUsed: 10, credits: 0 } });
    await ctx.http().post(`/api/descriptions/${image.id}/edit-packs`).set(auth(token)).expect(402);
  });

  it('[AC-DESC-004] accepts manual edits, sanitizes them and validates the Allegro title limit', async () => {
    const { token } = await registerUser(ctx);
    const image = await imageWithGraphic(token);
    await ctx.http().post(`/api/descriptions/${image.id}`).set(auth(token)).send({}).expect(201);

    const edited = await ctx
      .http()
      .patch(`/api/descriptions/${image.id}`)
      .set(auth(token))
      .send({
        title: '  Kubek ceramiczny 350 ml biały  ',
        body: '<div><h3>Opis</h3><p style="color:red">Ręcznie <a href="http://x">poprawiony</a> opis kubka.</p><img src=x onerror=alert(1)></div>',
        keywords: ['Kubek', 'kubek', 'biały kubek'],
      })
      .expect(200);
    expect(edited.body.description).toMatchObject({
      title: 'Kubek ceramiczny 350 ml biały',
      body: '<h2>Opis</h2><p>Ręcznie poprawiony opis kubka.</p>',
      keywords: ['kubek', 'biały kubek'],
    });
    // Manual edits never touch the rewrite counter.
    expect(edited.body.promptEditsLeft).toBe(5);

    const tooLong = await ctx
      .http()
      .patch(`/api/descriptions/${image.id}`)
      .set(auth(token))
      .send({ title: 'x'.repeat(76), body: '<p>Wystarczająco długi opis do testu.</p>' })
      .expect(400);
    expect(JSON.stringify(tooLong.body.message)).toContain('75');

    await ctx
      .http()
      .patch(`/api/descriptions/${image.id}`)
      .set(auth(token))
      .send({ title: 'Kubek', body: '<p>za krótko</p>' })
      .expect(400);
    await ctx
      .http()
      .patch(`/api/descriptions/${image.id}`)
      .set(auth(token))
      .send({ title: 'Kubek', body: '<p>ok</p>', extra: 1 })
      .expect(400);
  });

  it('[AC-DESC-005] is private to the owner and disappears with the photo', async () => {
    const owner = await registerUser(ctx);
    const other = await registerUser(ctx);
    const image = await imageWithGraphic(owner.token);
    await ctx.http().post(`/api/descriptions/${image.id}`).set(auth(owner.token)).send({}).expect(201);

    await ctx.http().get(`/api/descriptions/${image.id}`).set(auth(other.token)).expect(403);
    await ctx
      .http()
      .post(`/api/descriptions/${image.id}/refine`)
      .set(auth(other.token))
      .send({ instruction: 'zmień ton' })
      .expect(403);
    await ctx.http().post(`/api/descriptions/${image.id}/edit-packs`).set(auth(other.token)).expect(403);
    await ctx
      .http()
      .patch(`/api/descriptions/${image.id}`)
      .set(auth(other.token))
      .send({ title: 'Kubek', body: '<p>Wystarczająco długi opis.</p>' })
      .expect(403);
    await ctx.http().get('/api/descriptions/does-not-exist').set(auth(owner.token)).expect(404);

    await ctx.http().delete(`/api/images/${image.id}`).set(auth(owner.token)).expect(200);
    expect(await ctx.prisma.offerDescription.findUnique({ where: { imageId: image.id } })).toBeNull();
  });
});
