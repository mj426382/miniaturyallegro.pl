/**
 * Spec 17, AC-E2E-002: the full-stack test server (test/e2e-server.ts) wipes and migrates its
 * database on start. It must never run against production – refuse anything that is not clearly
 * a local throw-away test database.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function assertSafeE2eEnv(env: Record<string, string | undefined>): string {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to start the e2e test server with NODE_ENV=production');
  }
  const raw = env.E2E_DATABASE_URL;
  if (!raw) throw new Error('E2E_DATABASE_URL is required (a local database whose name contains "test")');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('E2E_DATABASE_URL is not a valid URL');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/test/i.test(database)) {
    throw new Error(`Refusing to reset database "${database}" – its name must contain "test"`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Refusing to use database host "${url.hostname}" – only a local database is allowed`);
  }
  return raw;
}
