import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';
import { ExportService } from './export.service';

async function square(size = 400): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .png()
    .toBuffer();
}

describe('ExportService', () => {
  const service = new ExportService();

  it('[AC-EXP-001] exports 1:1 at the requested size as JPEG by default', async () => {
    const { buffer, contentType, extension } = await service.exportImage(await square(), { size: 800 });
    const meta = await sharp(buffer).metadata();
    expect([meta.width, meta.height]).toEqual([800, 800]);
    expect(meta.format).toBe('jpeg');
    expect(contentType).toBe('image/jpeg');
    expect(extension).toBe('jpg');
  });

  it('[AC-EXP-002] pads to 4:3 and 16:9 with a white background without cropping', async () => {
    const wide = await service.exportImage(await square(), { ratio: '4:3', size: 1200, format: 'png' });
    const meta = await sharp(wide.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 900]);
    // Left edge is padding -> white.
    const { data } = await sharp(wide.buffer)
      .extract({ left: 2, top: 450, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);

    const portrait = await service.exportImage(await square(), { ratio: '3:4', size: 1000 });
    const pm = await sharp(portrait.buffer).metadata();
    expect([pm.width, pm.height]).toEqual([750, 1000]);
  });

  it('[AC-EXP-003] clamps the size and renders a promo badge', async () => {
    const plain = await service.exportImage(await square(), { size: 99999, format: 'png' });
    expect((await sharp(plain.buffer).metadata()).width).toBe(2560);

    const withBadge = await service.exportImage(await square(), {
      size: 600,
      format: 'png',
      badgeText: '-20%',
      badgeColor: 'blue',
      badgePosition: 'top-left',
    });
    // Badge pixel near the top-left corner is blue-ish, not the red product colour.
    const { data } = await sharp(withBadge.buffer)
      .extract({ left: 40, top: 40, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[2]).toBeGreaterThan(data[0]);
  });

  it('[AC-EXP-004] crops to the user-chosen region instead of padding', async () => {
    // Left half red, right half blue.
    const blue = await sharp({ create: { width: 200, height: 400, channels: 3, background: { r: 30, g: 40, b: 220 } } })
      .png()
      .toBuffer();
    const halves = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .composite([{ input: blue, left: 200, top: 0 }])
      .png()
      .toBuffer();

    const { buffer } = await service.exportImage(halves, {
      ratio: '4:3',
      size: 800,
      format: 'png',
      crop: { left: 0.5, top: 0.125, width: 0.5, height: 0.375 },
    });
    const meta = await sharp(buffer).metadata();
    expect([meta.width, meta.height]).toEqual([800, 600]);
    const corners = await Promise.all(
      [
        [2, 2],
        [797, 597],
      ].map(([left, top]) => sharp(buffer).extract({ left, top, width: 1, height: 1 }).raw().toBuffer()),
    );
    // Every pixel comes from the blue half – no white padding, no red.
    for (const px of corners) expect(px[2]).toBeGreaterThan(px[0]);

    await expect(service.exportImage(halves, { crop: { left: 0.8, top: 0, width: 0.5, height: 0.5 } })).rejects.toThrow(
      /poza/,
    );
    await expect(service.exportImage(halves, { crop: { left: 0, top: 0, width: 0.05, height: 0.05 } })).rejects.toThrow(
      /za mały/,
    );
  });

  it('[AC-EXP-005] rotates before framing and applies tone corrections', async () => {
    const blue = await sharp({ create: { width: 200, height: 400, channels: 3, background: { r: 30, g: 40, b: 220 } } })
      .png()
      .toBuffer();
    const halves = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .composite([{ input: blue, left: 200, top: 0 }])
      .png()
      .toBuffer();
    const px = async (buffer: Buffer, left: number, top: number) => [
      ...(await sharp(buffer).extract({ left, top, width: 1, height: 1 }).raw().toBuffer()),
    ];

    // 90° clockwise: the right (blue) half ends up at the bottom.
    const rotated = await service.exportImage(halves, { size: 500, format: 'png', rotate: 90 });
    expect((await px(rotated.buffer, 250, 20))[0]).toBeGreaterThan(150); // top = red
    expect((await px(rotated.buffer, 250, 480))[2]).toBeGreaterThan(150); // bottom = blue

    // Crop fractions refer to the rotated image: bottom half after rotation is blue.
    const cropped = await service.exportImage(halves, {
      size: 500,
      format: 'png',
      rotate: 90,
      crop: { left: 0, top: 0.5, width: 1, height: 0.5 },
    });
    expect((await px(cropped.buffer, 20, 20))[2]).toBeGreaterThan(150);
    expect((await px(cropped.buffer, 480, 480))[2]).toBeGreaterThan(150);

    const grey = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 100, g: 100, b: 100 } },
    })
      .png()
      .toBuffer();
    const brighter = await service.exportImage(grey, { size: 500, format: 'png', adjust: { brightness: 1.5 } });
    expect((await px(brighter.buffer, 50, 50))[0]).toBeGreaterThan(130);
    const flatter = await service.exportImage(grey, { size: 500, format: 'png', adjust: { contrast: 0.5 } });
    expect((await px(flatter.buffer, 50, 50))[0]).toBeGreaterThan(105); // pulled towards mid grey (128)
    const desaturated = await service.exportImage(halves, { size: 500, format: 'png', adjust: { saturation: 0 } });
    const [r, g, b] = await px(desaturated.buffer, 20, 250);
    expect(Math.abs(r - g)).toBeLessThan(8);
    expect(Math.abs(g - b)).toBeLessThan(8);

    await expect(service.exportImage(grey, { rotate: 45 as any })).rejects.toThrow(BadRequestException);
    await expect(service.exportImage(grey, { adjust: { brightness: 3 } })).rejects.toThrow(/korekty/);
  });

  it('[AC-EXP-006] rejects invalid options', async () => {
    await expect(service.exportImage(await square(), { ratio: '2:1' as any })).rejects.toThrow(BadRequestException);
    await expect(service.exportImage(await square(), { badgeText: 'x'.repeat(40) })).rejects.toThrow(/plakietki/);
  });

  describe('platform presets (spec 08)', () => {
    it('[AC-PLT-002] uses the preset target size and never goes below its minimum', async () => {
      const olx = await service.exportImage(await square(), { platform: 'olx' });
      expect(olx.ratio).toBe('4:3');
      const om = await sharp(olx.buffer).metadata();
      expect([om.width, om.height]).toEqual([1500, 1125]);
      expect(om.format).toBe('jpeg');

      const amazon = await service.exportImage(await square(), { platform: 'amazon', size: 600 });
      const am = await sharp(amazon.buffer).metadata();
      expect([am.width, am.height]).toEqual([1000, 1000]);
    });

    it('[AC-PLT-003] rejects ratios, formats and badges outside the preset', async () => {
      await expect(service.exportImage(await square(), { platform: 'amazon', ratio: '4:3' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.exportImage(await square(), { platform: 'vinted', format: 'webp' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.exportImage(await square(), { platform: 'amazon', badgeText: 'NOWOŚĆ' })).rejects.toThrow(
        /Amazon/,
      );
      await expect(service.exportImage(await square(), { platform: 'nope' as any })).rejects.toThrow(
        BadRequestException,
      );
      // Vinted only discourages badges – the export still works.
      await expect(
        service.exportImage(await square(), { platform: 'vinted', badgeText: '-20%' }),
      ).resolves.toBeTruthy();
    });

    it('[AC-PLT-004] Amazon: trims white margins so the product fills ~85 % of a pure white canvas', async () => {
      // 1000 px white graphic with a 300 px red product in the middle.
      const product = await sharp({
        create: { width: 300, height: 300, channels: 3, background: { r: 200, g: 30, b: 30 } },
      })
        .png()
        .toBuffer();
      const graphic = await sharp({
        create: { width: 1000, height: 1000, channels: 3, background: { r: 255, g: 255, b: 255 } },
      })
        .composite([{ input: product, left: 350, top: 350 }])
        .png()
        .toBuffer();
      const { buffer } = await service.exportImage(graphic, { platform: 'amazon', size: 1000, format: 'png' });
      const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([1000, 1000]);
      const at = (x: number, y: number) => {
        const i = (y * info.width + x) * info.channels;
        return [data[i], data[i + 1], data[i + 2]];
      };
      expect(at(2, 2)).toEqual([255, 255, 255]);
      expect(at(997, 997)).toEqual([255, 255, 255]);
      // Product spans 850 px: from x≈75 to x≈925 on the middle row.
      expect(at(90, 500)[1]).toBeLessThan(100);
      expect(at(910, 500)[1]).toBeLessThan(100);
      expect(at(60, 500)).toEqual([255, 255, 255]);
      expect(at(940, 500)).toEqual([255, 255, 255]);
    });
  });
});
