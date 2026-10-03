// Regenerates docs/api/openapi.json from the running application (needs the test database: npm run test:db:up).
const { execSync } = require('child_process');
execSync('npx jest --config test/jest-e2e.json --runInBand test/openapi.e2e-spec.ts', {
  stdio: 'inherit',
  env: { ...process.env, OPENAPI_WRITE: 'true' },
});
