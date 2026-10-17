import sharp from 'sharp';
import { crc32 } from 'zlib';
import { AI_DISCLOSURE_XMP } from './export.service';

/**
 * Spec 06, AC-EXP-024: the IPTC "AI composite" marker (same XMP packet as the export) for AI graphics that
 * are served as stored – single download, ZIP entries – and for infographics.
 *
 * Works on any stored file, so graphics generated before the change are covered too. PNG and JPEG get the
 * packet inserted at byte level (no re-encoding, no quality loss, cheap enough per request); WebP, or a
 * file that already carries an XMP packet, is re-encoded once with the packet replacing any other XMP.
 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_XMP_KEYWORD = 'XML:com.adobe.xmp';
const JPEG_XMP_NAMESPACE = 'http://ns.adobe.com/xap/1.0/\0';
const MAX_JPEG_SEGMENT = 0xffff - 2;

export async function withAiDisclosure(file: Buffer): Promise<Buffer> {
  if (isPng(file)) return injectPng(file) ?? reencode(file);
  if (isJpeg(file)) return injectJpeg(file) ?? reencode(file);
  return reencode(file);
}

function isPng(file: Buffer): boolean {
  return file.length > 33 && file.subarray(0, 8).equals(PNG_SIGNATURE);
}

function isJpeg(file: Buffer): boolean {
  return file.length > 4 && file[0] === 0xff && file[1] === 0xd8;
}

/** iTXt chunk "XML:com.adobe.xmp" right after IHDR; null when the PNG already has XMP or is malformed. */
function injectPng(file: Buffer): Buffer | null {
  let offset = 8;
  let afterIhdr = -1;
  while (offset + 12 <= file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > file.length) return null;
    if (type === 'IHDR') afterIhdr = end;
    if (
      (type === 'iTXt' || type === 'zTXt' || type === 'tEXt') &&
      file.toString('latin1', offset + 8, offset + 8 + PNG_XMP_KEYWORD.length + 1) === `${PNG_XMP_KEYWORD}\0`
    ) {
      return null;
    }
    if (type === 'IEND') break;
    offset = end;
  }
  if (afterIhdr < 0) return null;
  // keyword \0, compression flag 0, method 0, empty language tag \0, empty translated keyword \0, UTF-8 text
  const data = Buffer.concat([
    Buffer.from(`${PNG_XMP_KEYWORD}\0\0\0\0\0`, 'latin1'),
    Buffer.from(AI_DISCLOSURE_XMP, 'utf8'),
  ]);
  const type = Buffer.from('iTXt', 'latin1');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0);
  return Buffer.concat([file.subarray(0, afterIhdr), length, type, data, crc, file.subarray(afterIhdr)]);
}

/** APP1 XMP segment after SOI (and after a JFIF APP0); null when the JPEG already has XMP or is malformed. */
function injectJpeg(file: Buffer): Buffer | null {
  let offset = 2;
  let insertAt = 2;
  while (offset + 4 <= file.length && file[offset] === 0xff) {
    const marker = file[offset + 1];
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end of image
    const length = file.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (end > file.length) return null;
    if (
      marker === 0xe1 &&
      file.toString('latin1', offset + 4, offset + 4 + JPEG_XMP_NAMESPACE.length) === JPEG_XMP_NAMESPACE
    ) {
      return null;
    }
    if (marker === 0xe0 && offset === insertAt) insertAt = end; // keep JFIF first
    offset = end;
  }
  const payload = Buffer.concat([Buffer.from(JPEG_XMP_NAMESPACE, 'latin1'), Buffer.from(AI_DISCLOSURE_XMP, 'utf8')]);
  if (payload.length > MAX_JPEG_SEGMENT) return null;
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([file.subarray(0, insertAt), header, payload, file.subarray(insertAt)]);
}

/** Same format, the disclosure as the only XMP (other metadata dropped), ICC profile kept. */
async function reencode(file: Buffer): Promise<Buffer> {
  const image = sharp(file, { limitInputPixels: 40_000_000 });
  const { format, icc } = await image.metadata();
  let pipeline = image.withXmp(AI_DISCLOSURE_XMP);
  if (icc?.length) pipeline = pipeline.keepIccProfile();
  if (format === 'png') return pipeline.png({ compressionLevel: 8 }).toBuffer();
  if (format === 'jpeg') return pipeline.jpeg({ quality: 95 }).toBuffer();
  return pipeline.webp({ quality: 95 }).toBuffer();
}
