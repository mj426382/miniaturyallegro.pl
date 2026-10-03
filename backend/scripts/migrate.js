#!/usr/bin/env node
/**
 * Baseline-aware migration runner used by the Docker CMD (and `npm run prisma:deploy`).
 *
 * History: the first two migrations (`20260409095725_init`, `20260411062123_add_google_auth`)
 * were applied to production before migrations were tracked in git. If the production
 * `_prisma_migrations` table does not list them (or does not exist at all) while the
 * schema is clearly there, `prisma migrate deploy` would try to re-create the tables and
 * crash-loop the container. This script marks such baseline migrations as applied
 * (`prisma migrate resolve --applied`) ONLY when the objects they create already exist,
 * then runs the normal `migrate deploy`.
 *
 * It never alters data. Set MIGRATE_BASELINE=false to disable the baseline step.
 */
const { execSync } = require('child_process');
const { Client } = require('pg');

const BASELINES = [
  { name: '20260409095725_init', check: `SELECT to_regclass('public.users') IS NOT NULL AS ok` },
  {
    name: '20260411062123_add_google_auth',
    check: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'googleId') AS ok`,
  },
];

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  if (process.env.MIGRATE_BASELINE !== 'false') {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const historyExists = (await client.query(`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS ok`))
        .rows[0].ok;
      const applied = new Set();
      if (historyExists) {
        const rows = (await client.query(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`))
          .rows;
        rows.forEach((r) => applied.add(r.migration_name));
      }
      for (const b of BASELINES) {
        if (applied.has(b.name)) continue;
        const present = (await client.query(b.check)).rows[0].ok;
        if (present) {
          console.log(`Baseline: schema for ${b.name} already exists but is not recorded – marking as applied`);
          run(`npx prisma migrate resolve --applied ${b.name}`);
        } else {
          console.log(`Baseline: ${b.name} not applied and schema absent – will be applied by migrate deploy`);
        }
      }
      // Stale-generation heads-up: the reconciler will fail + refund these after boot.
      if (await client.query(`SELECT to_regclass('public.generations') IS NOT NULL AS ok`).then((r) => r.rows[0].ok)) {
        const { rows } = await client.query(
          `SELECT count(*)::int AS n FROM generations WHERE status IN ('PENDING','PROCESSING') AND "createdAt" < now() - interval '20 minutes'`,
        );
        if (rows[0].n > 0) {
          console.warn(
            `⚠️  ${rows[0].n} generation(s) are stuck in PENDING/PROCESSING – the reconciler will mark them FAILED and refund credits.`,
          );
        }
      }
    } finally {
      await client.end();
    }
  }

  run('npx prisma migrate deploy');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
