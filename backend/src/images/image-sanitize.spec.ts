import sharp from 'sharp';
import { describeMetadata, hasPrivateMetadata, stripImageMetadata } from './image-sanitize';
import { hasGpsTag, photoWithMetadata, pixel } from '../../test/metadata-fixtures';

describe('stripImageMetadata (spec 04)', () => {
  it('[AC-UPL-019] the JPEG fixture really carries EXIF with GPS, XMP, IPTC, ICC and orientation 6', async () => {
    const meta = await sharp(await photoWithMetadata('jpeg')).metadata();
    expect(hasGpsTag(meta.exif)).toBe(true);
    expect(meta.exif!.toString('latin1')).toContain('TestCam');
    expect(meta.xmp!.toString()).toContain('Jan Kowalski');
    expect(meta.iptc!.toString('latin1')).toContain('Jan Kowalski');
    expect(meta.icc?.length).toBeGreaterThan(0);
    expect(meta.orientation).toBe(6);
  });

  it('[AC-UPL-019] removes EXIF/GPS/XMP/IPTC from a JPEG, applies the orientation and keeps the ICC profile', async () => {
    const input = await photoWithMetadata('jpeg');
    const output = await stripImageMetadata(input, 'jpeg');
    const meta = await sharp(output).metadata();

    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(output.includes(Buffer.from('Jan Kowalski'))).toBe(false);
    expect(output.includes(Buffer.from('TestCam'))).toBe(false);
    // Orientation 6 = rotate 90° clockwise: the 300×200 photo is stored upright as 200×300 and the
    // red left half of the sensor image is now on top.
    expect([meta.width, meta.height]).toEqual([200, 300]);
    const top = await pixel(output, 100, 40);
    const bottom = await pixel(output, 100, 260);
    expect(top[0]).toBeGreaterThan(150);
    expect(top[2]).toBeLessThan(100);
    expect(bottom[2]).toBeGreaterThan(150);
    expect(bottom[0]).toBeLessThan(100);
    // Display P3 stays Display P3 (colours are not silently converted to sRGB).
    const icc = (await sharp(output).metadata()).icc!;
    expect(icc.equals((await sharp(input).metadata()).icc!)).toBe(true);
    expect(icc.toString('latin1').split(String.fromCharCode(0)).join('')).toContain('P3');
    expect(hasPrivateMetadata(await describeMetadata(output))).toBe(false);
  });

  it.each(['png', 'webp'] as const)(
    '[AC-UPL-019] removes EXIF/GPS/XMP from %s and keeps the format',
    async (format) => {
      const input = await photoWithMetadata(format);
      expect(hasPrivateMetadata(await describeMetadata(input))).toBe(true);
      const output = await stripImageMetadata(input, format);
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe(format);
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect([meta.width, meta.height]).toEqual([300, 200]);
      expect(meta.icc?.length).toBeGreaterThan(0);
      expect(output.includes(Buffer.from('Jan Kowalski'))).toBe(false);
    },
  );

  it('[AC-UPL-019] a photo without metadata stays clean and keeps its size', async () => {
    const plain = await sharp({ create: { width: 120, height: 150, channels: 3, background: '#336699' } })
      .jpeg()
      .toBuffer();
    const output = await stripImageMetadata(plain, 'jpeg');
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height, meta.exif, meta.orientation]).toEqual([120, 150, undefined, undefined]);
  });
});
