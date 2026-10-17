/**
 * One-off maintenance: re-encode stored originals without EXIF/GPS/XMP/IPTC (spec 04, AC-UPL-024).
 * Uploads are stripped on arrival since 2026-10-18; this cleans the photos stored before that.
 *
 * NOT run automatically. Dry run by default – it only counts. Run from backend/ with the production
 * DATABASE_URL and B2_* variables in the environment (never commit them):
 *
 *   npx ts-node --transpile-only scripts/strip-exif-existing.ts                 # dry run, all originals
 *   npx ts-node --transpile-only scripts/strip-exif-existing.ts --max=20 --apply  # try a small sample
 *   npx ts-node --transpile-only scripts/strip-exif-existing.ts --apply --batch-size=50
 *   npx ts-node --transpile-only scripts/strip-exif-existing.ts --apply --after=<last id from the log>
 *   add --demo to also process landing-demo photos (deleted after 30 days anyway; resume with --demo-after=<id>)
 *
 * Files are overwritten under the same key (no database change). On Backblaze B2 the old content stays
 * as a previous file version until the bucket's lifecycle rule ("keep only the last version") removes it.
 * The log contains only row ids and counts.
 */
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { StorageService } from '../src/images/storage.service';
import { StripExistingSource, stripExistingFiles } from '../src/images/strip-existing';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const batchSize = Number(arg('batch-size') ?? 100);
  const maxRows = arg('max') !== undefined ? Number(arg('max')) : undefined;
  const afterId = arg('after');
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('--batch-size must be a positive integer');
  if (maxRows !== undefined && (!Number.isInteger(maxRows) || maxRows < 1)) throw new Error('--max must be positive');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  // Keep the storage service quiet: its start-up log names the storage backend, nothing else.
  Logger.overrideLogger(['error']);
  const prisma = new PrismaClient();
  const storage = new StorageService(new ConfigService(process.env));
  const log = (line: string) => console.log(line);

  const sources: StripExistingSource[] = [
    {
      name: 'images',
      nextBatch: (after, take) =>
        prisma.image
          .findMany({
            where: after ? { id: { gt: after } } : {},
            orderBy: { id: 'asc' },
            take,
            select: { id: true, filename: true },
          })
          .then((rows) => rows.map((r) => ({ id: r.id, key: r.filename }))),
    },
  ];
  if (process.argv.includes('--demo')) {
    sources.push({
      name: 'demo',
      nextBatch: (after, take) =>
        prisma.demoRequest
          .findMany({
            where: after ? { id: { gt: after } } : {},
            orderBy: { id: 'asc' },
            take,
            select: { id: true, imageKey: true },
          })
          .then((rows) => rows.map((r) => ({ id: r.id, key: r.imageKey }))),
    });
  }

  try {
    for (const source of sources) {
      await stripExistingFiles(source, storage, {
        apply,
        batchSize,
        maxRows,
        afterId: source.name === 'images' ? afterId : arg('demo-after'),
        log,
      });
    }
    if (!apply) log('Dry run only – nothing was changed. Add --apply to re-encode the files listed above.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`strip-exif-existing failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
