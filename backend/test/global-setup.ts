import { execSync } from 'child_process';
import './setup-env';

/** Applies all migrations to the test database once per test run. */
export default async function globalSetup() {
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env },
      cwd: __dirname + '/..',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '\nCould not prepare the test database. Start it with:\n' +
        '  docker compose -f infra/docker-compose.test.yml up -d\n' +
        `(DATABASE_URL=${process.env.DATABASE_URL})\n`,
    );
    throw err;
  }
}
