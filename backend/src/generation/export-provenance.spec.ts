import sharp from 'sharp';
import { AI_DIGITAL_SOURCE_TYPE, ExportService } from './export.service';
import { digitalSourceType, hasGpsTag, photoWithMetadata } from '../../test/metadata-fixtures';

describe('export metadata (spec 06, Google Merchant Center AI disclosure)', () => {
  const service = new ExportService();
  const formats = ['jpeg', 'png', 'webp'] as const;

  it.each(formats)(
    '[AC-EXP-022] an AI graphic exported as %s declares compositeWithTrainedAlgorithmicMedia',
    async (format) => {
      // A "generated" graphic that – worst case – still carries EXIF/GPS from somewhere upstream.
      const graphic = await photoWithMetadata(format === 'jpeg' ? 'jpeg' : 'png', { orientation: 1 });
      const out = await service.exportImage(graphic, { format, size: 600, ratio: '4:3' }, 'ai-composite');
      const meta = await sharp(out.buffer).metadata();
      expect(meta.format).toBe(format);
      expect(await digitalSourceType(out.buffer)).toBe(AI_DIGITAL_SOURCE_TYPE);
      expect(AI_DIGITAL_SOURCE_TYPE).toBe(
        'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
      );
      // Only the disclosure – no EXIF, GPS or author from the input.
      expect(meta.exif).toBeUndefined();
      expect(hasGpsTag(meta.exif)).toBe(false);
      expect(out.buffer.includes(Buffer.from('Jan Kowalski'))).toBe(false);
    },
  );

  it('[AC-EXP-022] the disclosure survives presets, crop, rotation, tone and a badge', async () => {
    const graphic = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#fafafa' } })
      .png()
      .toBuffer();
    const out = await service.exportImage(
      graphic,
      {
        platform: 'generic',
        ratio: '1:1',
        rotate: 90,
        crop: { left: 0.1, top: 0.1, width: 0.8, height: 0.8 },
        adjust: { brightness: 1.1, contrast: 1.1, saturation: 1.2, sharpen: true },
        badgeText: '-20%',
      },
      'ai-composite',
    );
    expect(await digitalSourceType(out.buffer)).toBe(AI_DIGITAL_SOURCE_TYPE);
  });

  it.each(formats)(
    '[AC-EXP-023] the original photo exported as %s has no disclosure and no metadata',
    async (format) => {
      const photo = await photoWithMetadata(format === 'jpeg' ? 'jpeg' : 'png', { orientation: 1 });
      const out = await service.exportImage(photo, { format, size: 600 }, 'original-photo');
      const meta = await sharp(out.buffer).metadata();
      expect(await digitalSourceType(out.buffer)).toBeNull();
      expect(meta.xmp).toBeUndefined();
      expect(meta.exif).toBeUndefined();
      // The default (no provenance given) is the safe "original" – nothing is claimed.
      const byDefault = await service.exportImage(photo, { format, size: 600 });
      expect(await digitalSourceType(byDefault.buffer)).toBeNull();
    },
  );
});
