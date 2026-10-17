import sharp from 'sharp';
import { withAiDisclosure } from './ai-disclosure';
import { AI_DIGITAL_SOURCE_TYPE } from './export.service';
import { AUTHOR_XMP, digitalSourceType } from '../../test/metadata-fixtures';

async function graphic(format: 'png' | 'jpeg' | 'webp', xmp?: string): Promise<Buffer> {
  let pipeline = sharp({ create: { width: 160, height: 120, channels: 3, background: { r: 180, g: 60, b: 30 } } });
  if (xmp) pipeline = pipeline.withXmp(xmp);
  return pipeline.toFormat(format).toBuffer();
}

const raw = (file: Buffer) => sharp(file).raw().toBuffer();
const packets = (xmp: Buffer | undefined) => (xmp?.toString('utf8').match(/DigitalSourceType>/g) ?? []).length / 2;

describe('AI disclosure for stored graphics (spec 06)', () => {
  it.each(['png', 'jpeg'] as const)(
    '[AC-EXP-024] %s: adds the marker at byte level – identical pixels, readable XMP',
    async (format) => {
      const input = await graphic(format);
      const out = await withAiDisclosure(input);
      expect(await digitalSourceType(out)).toBe(AI_DIGITAL_SOURCE_TYPE);
      const meta = await sharp(out).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual([format, 160, 120]);
      expect(packets(meta.xmp)).toBe(1);
      // No re-encoding: decoded pixels are bit-identical and the image data is carried over verbatim.
      expect((await raw(out)).equals(await raw(input))).toBe(true);
      expect(out.length).toBeGreaterThan(input.length);
      // The input buffer is not modified (the stored file stays as it is).
      expect(await digitalSourceType(input)).toBeNull();
    },
  );

  it('[AC-EXP-024] JPEG with a JFIF header keeps APP0 first; applying twice does not duplicate the packet', async () => {
    // libvips writes no APP0 – add the JFIF header most other encoders (and many stored files) have.
    const plain = await graphic('jpeg');
    const jfif = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    const input = Buffer.concat([plain.subarray(0, 2), jfif, plain.subarray(2)]);
    expect(input.toString('latin1', 6, 10)).toBe('JFIF');
    const out = await withAiDisclosure(input);
    expect(out.toString('latin1', 6, 10)).toBe('JFIF');
    expect(await digitalSourceType(out)).toBe(AI_DIGITAL_SOURCE_TYPE);
    const twice = await withAiDisclosure(out);
    expect(packets((await sharp(twice).metadata()).xmp)).toBe(1);
  });

  it.each(['png', 'jpeg', 'webp'] as const)(
    '[AC-EXP-024] %s with its own XMP (or WebP): one packet, ours replaces the old one',
    async (format) => {
      const input = await graphic(format, AUTHOR_XMP);
      const out = await withAiDisclosure(input);
      const meta = await sharp(out).metadata();
      expect(meta.format).toBe(format);
      expect(await digitalSourceType(out)).toBe(AI_DIGITAL_SOURCE_TYPE);
      expect(packets(meta.xmp)).toBe(1);
      expect(meta.xmp!.toString('utf8')).not.toContain('Jan Kowalski');
    },
  );

  it('[AC-EXP-024] a plain WebP gets the marker too', async () => {
    const out = await withAiDisclosure(await graphic('webp'));
    expect((await sharp(out).metadata()).format).toBe('webp');
    expect(await digitalSourceType(out)).toBe(AI_DIGITAL_SOURCE_TYPE);
  });
});
