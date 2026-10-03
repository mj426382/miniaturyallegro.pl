import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createTestApp, TestContext } from './test-app';

/**
 * The API contract (docs/api/openapi.json) is generated from the code and versioned in the repo
 * (docs/specs/12-api.md). This test fails when an endpoint or DTO changed without regenerating it:
 *   cd backend && npm run openapi
 */
const OUTPUT = resolve(__dirname, '../../docs/api/openapi.json');

describe('OpenAPI contract', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('[AC-API-001] docs/api/openapi.json matches the running application', () => {
    const config = new DocumentBuilder()
      .setTitle('AllGrafika API')
      .setDescription('API for generating product graphics')
      .setVersion('1.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(ctx.app, config);
    const generated = JSON.stringify(document, null, 2) + '\n';

    if (process.env.OPENAPI_WRITE === 'true') {
      mkdirSync(resolve(OUTPUT, '..'), { recursive: true });
      writeFileSync(OUTPUT, generated, 'utf-8');
      console.log(`OpenAPI written to ${OUTPUT}`);
      return;
    }

    expect(existsSync(OUTPUT)).toBe(true);
    const committed = readFileSync(OUTPUT, 'utf-8');
    if (committed !== generated) {
      throw new Error(
        'docs/api/openapi.json is out of date – run "cd backend && npm run openapi" and commit the result.',
      );
    }
    expect(Object.keys(document.paths).length).toBeGreaterThan(20);
  });
});
