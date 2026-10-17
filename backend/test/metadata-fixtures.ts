import sharp from 'sharp';

/**
 * Photos with privacy-relevant metadata, generated in the test (no binary fixtures in git):
 * EXIF with camera, owner and GPS position, XMP with the author, IPTC (JPEG, Photoshop APP13) and a
 * Display-P3 ICC profile. The left half of the picture is red and the right half blue, so a test can
 * tell whether the EXIF orientation was applied to the pixels.
 */
export const GPS_EXIF = {
  IFD0: { Make: 'TestCam', Model: 'Phone 1', Artist: 'Jan Kowalski', Copyright: 'Jan Kowalski' },
  IFD3: {
    GPSLatitudeRef: 'N',
    GPSLatitude: '52/1 24/1 1234/100',
    GPSLongitudeRef: 'E',
    GPSLongitude: '21/1 0/1 0/1',
  },
};

export const AUTHOR_XMP =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
  '<dc:creator><rdf:Seq><rdf:li>Jan Kowalski</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>';

/** The EXIF GPS IFD pointer tag (0x8825) in either byte order. */
export function hasGpsTag(exif: Buffer | undefined): boolean {
  if (!exif) return false;
  return exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88]));
}

/** Inserts a Photoshop APP13 segment with an IPTC By-line ("Jan Kowalski") right after the JPEG SOI. */
export function withIptc(jpeg: Buffer, byline = 'Jan Kowalski'): Buffer {
  const text = Buffer.from(byline, 'latin1');
  const dataset = Buffer.concat([Buffer.from([0x1c, 0x02, 0x50, 0x00, text.length]), text]);
  const padded = dataset.length % 2 ? Buffer.concat([dataset, Buffer.from([0])]) : dataset;
  const size = Buffer.alloc(4);
  size.writeUInt32BE(dataset.length);
  const resource = Buffer.concat([Buffer.from('8BIM', 'latin1'), Buffer.from([0x04, 0x04, 0x00, 0x00]), size, padded]);
  const payload = Buffer.concat([Buffer.from('Photoshop 3.0\0', 'latin1'), resource]);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffed, 0);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), header, payload, jpeg.subarray(2)]);
}

/** 300×200: left half red, right half blue. */
export async function twoColourPng(width = 300, height = 200): Promise<Buffer> {
  const half = Math.floor(width / 2);
  const red = await sharp({ create: { width: half, height, channels: 3, background: { r: 220, g: 20, b: 20 } } })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 3, background: { r: 20, g: 20, b: 220 } } })
    .composite([{ input: red, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

/**
 * A "phone photo" with EXIF (camera, owner, GPS), XMP and a P3 ICC profile. JPEG also gets IPTC and,
 * by default, EXIF orientation 6 (stored sideways: the viewer must rotate 90° clockwise).
 */
export async function photoWithMetadata(
  format: 'jpeg' | 'png' | 'webp',
  options: { orientation?: number; width?: number; height?: number } = {},
): Promise<Buffer> {
  let pipeline = sharp(await twoColourPng(options.width, options.height));
  const orientation = options.orientation ?? (format === 'jpeg' ? 6 : undefined);
  // withMetadata() would attach sRGB, so it goes first and the P3 profile after it.
  if (orientation) pipeline = pipeline.withMetadata({ orientation });
  pipeline = pipeline.withExif(GPS_EXIF).withXmp(AUTHOR_XMP).withIccProfile('p3');
  const buffer = await pipeline.toFormat(format).toBuffer();
  return format === 'jpeg' ? withIptc(buffer) : buffer;
}

/** RGB of one pixel. */
export async function pixel(buffer: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data } = await sharp(buffer).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({
    resolveWithObject: true,
  });
  return [data[0], data[1], data[2]];
}

/** Reads Iptc4xmpExt:DigitalSourceType back from the XMP packet sharp reports for the file. */
export async function digitalSourceType(file: Buffer): Promise<string | null> {
  const xmp = (await sharp(file).metadata()).xmp?.toString('utf8');
  if (!xmp) return null;
  const element = xmp.match(/<Iptc4xmpExt:DigitalSourceType>([^<]+)<\/Iptc4xmpExt:DigitalSourceType>/);
  const attribute = xmp.match(/Iptc4xmpExt:DigitalSourceType="([^"]+)"/);
  return element?.[1] ?? attribute?.[1] ?? null;
}
