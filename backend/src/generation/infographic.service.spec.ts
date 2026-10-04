import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';
import {
  escapeXml,
  formatMeasure,
  INFOGRAPHIC_ICON_IDS,
  INFOGRAPHIC_ICONS,
  INFOGRAPHIC_SIZE,
  InfographicService,
  wrapText,
} from './infographic.service';

async function productOnWhite(): Promise<Buffer> {
  // 400×400 white canvas with a 120×200 red "product" in the middle.
  const product = await sharp({ create: { width: 120, height: 200, channels: 3, background: '#c0262d' } })
    .png()
    .toBuffer();
  return sharp({ create: { width: 400, height: 400, channels: 3, background: '#ffffff' } })
    .composite([{ input: product, left: 140, top: 100 }])
    .png()
    .toBuffer();
}

async function noisyScene(): Promise<Buffer> {
  const raw = Buffer.alloc(200 * 200 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919) % 251;
  return sharp(raw, { raw: { width: 200, height: 200, channels: 3 } })
    .png()
    .toBuffer();
}

describe('InfographicService', () => {
  const service = new InfographicService();

  it('[AC-INF-001] renders a 1600×1600 PNG for the features template', async () => {
    const out = await service.render(await productOnWhite(), {
      template: 'features',
      title: 'Kubek termiczny 450 ml',
      features: [
        { icon: 'shield', text: '2 lata gwarancji' },
        { icon: 'water', text: 'Szczelna pokrywka' },
        { icon: 'thermometer', text: 'Trzyma ciepło do 8 godzin' },
      ],
    });
    expect(out.contentType).toBe('image/png');
    const meta = await sharp(out.buffer).metadata();
    expect(meta).toMatchObject({ width: INFOGRAPHIC_SIZE, height: INFOGRAPHIC_SIZE, format: 'png' });
  });

  it('[AC-INF-001] supports JPEG, the dark theme and every built-in icon', async () => {
    const source = await productOnWhite();
    for (let i = 0; i < INFOGRAPHIC_ICON_IDS.length; i += 6) {
      const features = INFOGRAPHIC_ICON_IDS.slice(i, i + 6).map((icon) => ({
        icon,
        text: INFOGRAPHIC_ICONS[icon].name,
      }));
      const out = await service.render(source, {
        template: 'features',
        features,
        theme: 'dark',
        accent: 'green',
        format: 'jpeg',
      });
      expect(out.contentType).toBe('image/jpeg');
      const meta = await sharp(out.buffer).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([INFOGRAPHIC_SIZE, INFOGRAPHIC_SIZE, 'jpeg']);
    }
    expect(INFOGRAPHIC_ICON_IDS).toHaveLength(20);
  });

  it('[AC-INF-002] renders the dimensions template and requires width or height', async () => {
    const out = await service.render(await productOnWhite(), {
      template: 'dimensions',
      dimensions: { width: 12.5, height: 30, depth: 8, unit: 'cm', weight: 1.25, weightUnit: 'kg' },
    });
    const meta = await sharp(out.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([INFOGRAPHIC_SIZE, INFOGRAPHIC_SIZE]);

    await expect(
      service.render(await productOnWhite(), { template: 'dimensions', dimensions: { depth: 3, unit: 'cm' } }),
    ).rejects.toThrow('Podaj co najmniej szerokość albo wysokość');
  });

  it('[AC-INF-003] encodes markup characters and keeps Polish letters', () => {
    expect(escapeXml('<svg onload="x()">Żółć & "ą" \'ę\'</svg>')).toBe(
      '&lt;svg onload=&quot;x()&quot;&gt;Żółć &amp; &quot;ą&quot; &apos;ę&apos;&lt;/svg&gt;',
    );
  });

  it('[AC-INF-003] user text cannot inject SVG elements into the render', async () => {
    const spy = jest.spyOn(Buffer, 'from');
    try {
      await service.render(await productOnWhite(), {
        template: 'features',
        title: '<image href="file:///etc/passwd"/>',
        features: [{ icon: 'check', text: '</text><script>alert(1)</script>' }],
      });
      const svgs = spy.mock.calls
        .map((c) => c[0])
        .filter((v): v is string => typeof v === 'string' && v.startsWith('<svg') && v.includes('font-family'));
      expect(svgs.length).toBeGreaterThan(0);
      const svg = svgs[svgs.length - 1];
      expect(svg).not.toContain('<script');
      expect(svg).not.toContain('<image');
      expect(svg).toContain('&lt;/text&gt;&lt;script&gt;');
    } finally {
      spy.mockRestore();
    }
  });

  it('[AC-INF-004] wraps to two lines with an ellipsis and formats numbers the Polish way', () => {
    expect(wrapText('Szczelna pokrywka', 23, 2)).toEqual(['Szczelna pokrywka']);
    expect(wrapText('Bardzo długi opis cechy, który na pewno nie zmieści się w dwóch liniach', 23, 2)).toEqual([
      'Bardzo długi opis',
      'cechy, który na pewno…',
    ]);
    for (const line of wrapText('a'.repeat(60), 23, 2)) expect(line.length).toBeLessThanOrEqual(23);
    expect(wrapText('a'.repeat(60), 23, 2)[1].endsWith('…')).toBe(true);
    expect(formatMeasure(12.5, 'cm')).toBe('12,5 cm');
    expect(formatMeasure(3, 'mm')).toBe('3 mm');
    expect(formatMeasure(1.257, 'kg')).toBe('1,26 kg');
  });

  it('[AC-INF-005] rejects invalid input with Polish messages', () => {
    const bad = (opts: any) => expect(() => service.validate(opts)).toThrow(BadRequestException);
    bad({ template: 'features', features: [] });
    bad({ template: 'features', features: Array.from({ length: 7 }, () => ({ icon: 'check', text: 'x' })) });
    bad({ template: 'features', features: [{ icon: 'unicorn', text: 'x' }] });
    bad({ template: 'features', features: [{ icon: 'check', text: '   ' }] });
    bad({ template: 'features', features: [{ icon: 'check', text: 'x'.repeat(49) }] });
    bad({ template: 'dimensions', dimensions: { width: 0, unit: 'cm' } });
    bad({ template: 'dimensions', dimensions: { width: -2, unit: 'cm' } });
    bad({ template: 'dimensions', dimensions: { width: 2, unit: 'inch' } });
    bad({ template: 'dimensions', dimensions: { width: 2, unit: 'cm', weight: 1, weightUnit: 'lb' } });
    bad({ template: 'poster' });
    bad({ template: 'features', title: 'x'.repeat(41), features: [{ icon: 'check', text: 'x' }] });
    expect(() => service.validate({ template: 'features', features: [{ icon: 'check', text: 'ok' }] })).not.toThrow();
  });

  it('[AC-INF-007] trims a uniform background but keeps the whole frame of a scene', async () => {
    const trimmed = await sharp(await service.trimUniformBackground(await productOnWhite())).metadata();
    expect(trimmed.width).toBeLessThan(200);
    expect(trimmed.height).toBeLessThan(260);

    const scene = await noisyScene();
    const kept = await sharp(await service.trimUniformBackground(scene)).metadata();
    expect([kept.width, kept.height]).toEqual([200, 200]);

    const blank = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const same = await sharp(await service.trimUniformBackground(blank)).metadata();
    expect([same.width, same.height]).toEqual([50, 50]);
  });
});
