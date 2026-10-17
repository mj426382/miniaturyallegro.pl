import sharp from 'sharp';
import { ALLOWED_IMAGE_FORMATS, AllowedImageFormat, MAX_IMAGE_PIXELS } from './image-validation';
import { describeMetadata, hasPrivateMetadata, stripImageMetadata } from './image-sanitize';

/**
 * Spec 04, AC-UPL-024: one-off clean-up of originals stored before metadata stripping existed.
 * Used by scripts/strip-exif-existing.ts; kept here so it is type-checked and unit-tested.
 *
 * - dry run unless `apply` is set (reports what would change, writes nothing),
 * - walks rows ordered by id in batches; `afterId` resumes after the last id a previous run reported,
 * - overwrites a file under the same key only when it carries EXIF/XMP/IPTC/comments or a rotation,
 *   and only after checking the re-encoded file is clean,
 * - logs ids and counts only – never file names, URLs or e-mail addresses.
 */
export interface StripExistingSource {
  /** Name used in the log ("images", "demo"). */
  name: string;
  /** Next batch of rows with id > afterId, ordered by id. */
  nextBatch(afterId: string | undefined, take: number): Promise<Array<{ id: string; key: string }>>;
}

export interface StripExistingStorage {
  getFileBuffer(key: string): Promise<{ buffer: Buffer }>;
  replaceFile(key: string, buffer: Buffer, mimeType: string): Promise<void>;
}

export interface StripExistingOptions {
  apply: boolean;
  batchSize: number;
  afterId?: string;
  /** Stop after this many rows (testing a small sample first). */
  maxRows?: number;
  log: (line: string) => void;
}

export interface StripExistingStats {
  scanned: number;
  withMetadata: number;
  cleaned: number;
  skipped: number;
  failed: number;
  lastId: string | null;
}

export async function stripExistingFiles(
  source: StripExistingSource,
  storage: StripExistingStorage,
  options: StripExistingOptions,
): Promise<StripExistingStats> {
  const stats: StripExistingStats = { scanned: 0, withMetadata: 0, cleaned: 0, skipped: 0, failed: 0, lastId: null };
  const batchSize = Math.max(1, Math.min(500, Math.floor(options.batchSize)));
  let afterId = options.afterId;
  const mode = options.apply ? 'APPLY' : 'DRY RUN';
  options.log(`[${source.name}] ${mode}: batch size ${batchSize}${afterId ? `, resuming after id ${afterId}` : ''}`);

  for (;;) {
    const remaining = options.maxRows !== undefined ? options.maxRows - stats.scanned : batchSize;
    if (remaining <= 0) break;
    const rows = await source.nextBatch(afterId, Math.min(batchSize, remaining));
    if (!rows.length) break;

    for (const row of rows) {
      stats.scanned++;
      afterId = row.id;
      stats.lastId = row.id;
      try {
        const { buffer } = await storage.getFileBuffer(row.key);
        const format = (await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata()).format as string;
        if (!ALLOWED_IMAGE_FORMATS.includes(format as AllowedImageFormat)) {
          stats.skipped++;
          options.log(`[${source.name}] ${row.id}: skipped (unsupported format)`);
          continue;
        }
        if (!hasPrivateMetadata(await describeMetadata(buffer))) continue;
        stats.withMetadata++;
        if (!options.apply) continue;

        const clean = await stripImageMetadata(buffer, format as AllowedImageFormat);
        if (hasPrivateMetadata(await describeMetadata(clean))) throw new Error('re-encoded file still has metadata');
        await storage.replaceFile(row.key, clean, `image/${format}`);
        stats.cleaned++;
      } catch (err) {
        stats.failed++;
        // The error text may contain a storage key – log only its class.
        options.log(`[${source.name}] ${row.id}: failed (${err instanceof Error ? err.name : 'error'})`);
      }
    }
    options.log(
      `[${source.name}] up to id ${afterId}: scanned ${stats.scanned}, with metadata ${stats.withMetadata}, cleaned ${stats.cleaned}, skipped ${stats.skipped}, failed ${stats.failed}`,
    );
  }

  options.log(
    `[${source.name}] ${mode} done: scanned ${stats.scanned}, with metadata ${stats.withMetadata}, cleaned ${stats.cleaned}, skipped ${stats.skipped}, failed ${stats.failed}` +
      (stats.lastId ? ` – resume with --after=${stats.lastId}` : ''),
  );
  return stats;
}
