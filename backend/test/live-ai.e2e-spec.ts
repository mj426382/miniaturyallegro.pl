/**
 * LIVE provider smoke test – talks to the real OpenAI + Gemini APIs and costs real money
 * (roughly 0.05 USD per run). It is skipped unless you opt in explicitly:
 *
 *   RUN_LIVE_AI_TESTS=true GEMINI_API_KEY=... OPENAI_API_KEY=... npm run test:live
 *
 * Never enabled in CI. Keys are read from the environment only (test mode ignores .env).
 */
import sharp from 'sharp';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../src/generation/gemini.service';
import { GENERATION_STYLES } from '../src/generation/styles';

const enabled =
  process.env.RUN_LIVE_AI_TESTS === 'true' && !!process.env.GEMINI_API_KEY && !!process.env.OPENAI_API_KEY;
const describeLive = enabled ? describe : describe.skip;

/** Synthetic "product": a red mug-like shape with a white label on a grey background. */
async function productPhoto(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="#d9d9d9"/>
    <rect x="140" y="120" width="220" height="280" rx="24" fill="#c62828"/>
    <path d="M360 180 h40 a50 50 0 0 1 0 100 h-40" fill="none" stroke="#c62828" stroke-width="28"/>
    <rect x="180" y="220" width="140" height="70" fill="#ffffff"/>
    <text x="250" y="266" font-family="Arial" font-size="34" font-weight="700" text-anchor="middle" fill="#c62828">MUG</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

describeLive('LIVE: real Gemini + OpenAI generation', () => {
  jest.setTimeout(240_000);
  const config = {
    get: (key: string) => process.env[key],
  } as unknown as ConfigService;
  const gemini = new GeminiService(config);

  it('[AC-GEN-020] describes the product, writes a style prompt and returns a decodable square image', async () => {
    const photo = await productPhoto();
    const base64 = photo.toString('base64');

    const description = await gemini.generateImageDescription(base64, 'image/jpeg');
    expect(description.length).toBeGreaterThan(60);
    expect(description.toLowerCase()).toMatch(/mug|cup|red/);

    const style = GENERATION_STYLES.find((s) => s.id === 'white-bg')!;
    const prompts = await gemini.generateAllStylePrompts(description, [style]);
    const prompt = prompts.get('white-bg')!;
    expect(prompt.length).toBeGreaterThan(80);
    expect(prompt).toMatch(/white/i);

    const generated = await gemini.generateImage(base64, 'image/jpeg', prompt);
    const buffer = Buffer.from(generated.base64, 'base64');
    const meta = await sharp(buffer).metadata();
    expect(['png', 'jpeg', 'webp']).toContain(meta.format);
    expect(meta.width!).toBeGreaterThanOrEqual(512);
    // 1:1 hint – allow a small tolerance in case the model ignores imageConfig
    const ratio = meta.width! / meta.height!;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);

    // eslint-disable-next-line no-console
    console.log(`LIVE result: ${meta.width}x${meta.height} ${meta.format}, ${buffer.length} bytes`);
  });
});
