import sharp from 'sharp';
import { StripExistingSource, StripExistingStorage, stripExistingFiles } from './strip-existing';
import { hasGpsTag, photoWithMetadata } from '../../test/metadata-fixtures';

/** In-memory storage + rows standing in for B2 and the images table. */
async function fixture() {
  const clean = await sharp({ create: { width: 120, height: 120, channels: 3, background: '#808080' } })
    .jpeg()
    .toBuffer();
  const files = new Map<string, Buffer>([
    ['originals/a.jpg', await photoWithMetadata('jpeg')],
    ['originals/b.png', await photoWithMetadata('png')],
    ['originals/c.jpg', clean],
    ['originals/d.webp', await photoWithMetadata('webp')],
    ['originals/e.jpg', Buffer.from('not an image')],
  ]);
  const rows = [
    { id: 'img-a', key: 'originals/a.jpg' },
    { id: 'img-b', key: 'originals/b.png' },
    { id: 'img-c', key: 'originals/c.jpg' },
    { id: 'img-d', key: 'originals/d.webp' },
    { id: 'img-e', key: 'originals/e.jpg' },
  ];
  const writes: string[] = [];
  const source: StripExistingSource = {
    name: 'images',
    nextBatch: async (after, take) => rows.filter((r) => !after || r.id > after).slice(0, take),
  };
  const storage: StripExistingStorage = {
    getFileBuffer: async (key) => ({ buffer: files.get(key)! }),
    replaceFile: async (key, buffer) => {
      writes.push(key);
      files.set(key, buffer);
    },
  };
  return { files, rows, writes, source, storage, clean };
}

describe('strip-exif-existing maintenance (spec 04)', () => {
  it('[AC-UPL-024] dry run (the default) changes nothing and only counts', async () => {
    const f = await fixture();
    const before = new Map(f.files);
    const lines: string[] = [];
    const stats = await stripExistingFiles(f.source, f.storage, {
      apply: false,
      batchSize: 2,
      log: (l) => lines.push(l),
    });
    expect(stats).toEqual({ scanned: 5, withMetadata: 3, cleaned: 0, skipped: 0, failed: 1, lastId: 'img-e' });
    expect(f.writes).toEqual([]);
    for (const [key, buffer] of before) expect(f.files.get(key)!.equals(buffer)).toBe(true);
    expect(lines[0]).toMatch(/DRY RUN/);
    // Batches of 2 → progress after img-b, img-d and img-e.
    expect(lines.filter((l) => /up to id/.test(l))).toHaveLength(3);
  });

  it('[AC-UPL-024] --apply rewrites only files with metadata, keeps orientation and ICC, logs ids and counts only', async () => {
    const f = await fixture();
    const lines: string[] = [];
    const stats = await stripExistingFiles(f.source, f.storage, {
      apply: true,
      batchSize: 100,
      log: (l) => lines.push(l),
    });
    expect(stats).toMatchObject({ scanned: 5, withMetadata: 3, cleaned: 3, failed: 1 });
    expect(f.writes.sort()).toEqual(['originals/a.jpg', 'originals/b.png', 'originals/d.webp']);
    // The clean JPEG was not touched (no needless re-encoding).
    expect(f.files.get('originals/c.jpg')!.equals(f.clean)).toBe(true);

    const a = await sharp(f.files.get('originals/a.jpg')!).metadata();
    expect([a.format, a.width, a.height, a.orientation, a.exif, a.xmp, a.iptc]).toEqual([
      'jpeg',
      200,
      300,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(a.icc?.length).toBeGreaterThan(0);
    for (const key of ['originals/b.png', 'originals/d.webp']) {
      const meta = await sharp(f.files.get(key)!).metadata();
      expect(hasGpsTag(meta.exif)).toBe(false);
      expect(meta.xmp).toBeUndefined();
    }
    // Logs: row ids and numbers – never storage keys or file names.
    const log = lines.join('\n');
    expect(log).not.toMatch(/originals\//);
    expect(log).toMatch(/img-e: failed/);
    expect(log).toMatch(/resume with --after=img-e/);

    // A second run finds nothing left to clean (idempotent).
    const again = await stripExistingFiles(f.source, f.storage, { apply: true, batchSize: 100, log: () => undefined });
    expect(again).toMatchObject({ withMetadata: 0, cleaned: 0 });
  });

  it('[AC-UPL-024] resumes after a given id and stops after --max rows', async () => {
    const f = await fixture();
    const resumed = await stripExistingFiles(f.source, f.storage, {
      apply: true,
      batchSize: 1,
      afterId: 'img-b',
      log: () => undefined,
    });
    expect(resumed.scanned).toBe(3);
    expect(f.writes).toEqual(['originals/d.webp']);

    const g = await fixture();
    const sample = await stripExistingFiles(g.source, g.storage, {
      apply: true,
      batchSize: 10,
      maxRows: 2,
      log: () => undefined,
    });
    expect(sample).toMatchObject({ scanned: 2, cleaned: 2, lastId: 'img-b' });
  });
});
