import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { GeminiService, buildImagePrompt, PRODUCT_INTEGRITY_CONSTRAINTS } from './gemini.service';
import { GENERATION_STYLES } from './styles';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const generateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent }),
  })),
}));

function configWith(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function openaiReply(content: string) {
  return { data: { choices: [{ message: { content } }] } };
}

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GeminiService(configWith({ OPENAI_API_KEY: 'k', GEMINI_API_KEY: 'g' }));
  });

  describe('buildImagePrompt', () => {
    it('[AC-GEN-017] appends the English product-integrity and Allegro output constraints', () => {
      const prompt = buildImagePrompt('  A product on a wooden table  ');
      expect(prompt.startsWith('A product on a wooden table')).toBe(true);
      expect(prompt).toContain(PRODUCT_INTEGRITY_CONSTRAINTS);
      expect(prompt).toMatch(/do NOT add any text/);
      expect(prompt).toMatch(/square 1:1/);
    });
  });

  describe('generateAllStylePrompts', () => {
    it('parses the JSON map returned by the prompt-engineering model', async () => {
      const styles = GENERATION_STYLES.slice(0, 2);
      mockedAxios.post.mockResolvedValueOnce(
        openaiReply(
          JSON.stringify({
            'white-bg': 'White studio prompt that is long enough',
            'lifestyle-home': 'Cozy living room prompt text',
          }),
        ),
      );

      const prompts = await service.generateAllStylePrompts('A red cube', styles, 'ciepłe kolory');

      expect(prompts.get('white-bg')).toBe('White studio prompt that is long enough');
      expect(prompts.get('lifestyle-home')).toBe('Cozy living room prompt text');

      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(body.messages[1].content).toContain('ciepłe kolory');
      expect(body.messages[1].content).toContain('"white-bg"');
    });

    it('falls back to the base style prompt for missing or malformed entries', async () => {
      const styles = GENERATION_STYLES.slice(0, 2);
      mockedAxios.post.mockResolvedValueOnce(
        openaiReply('```json\n{"white-bg": "ok prompt long enough to pass"}\n```'),
      );

      const prompts = await service.generateAllStylePrompts('A red cube', styles);
      expect(prompts.get('white-bg')).toBe('ok prompt long enough to pass');
      expect(prompts.get('lifestyle-home')).toBe(styles[1].prompt);
    });

    it('falls back to base prompts entirely when the model returns garbage', async () => {
      mockedAxios.post.mockResolvedValueOnce(openaiReply('not json at all'));
      const prompts = await service.generateAllStylePrompts('A red cube', GENERATION_STYLES);
      for (const style of GENERATION_STYLES) expect(prompts.get(style.id)).toBe(style.prompt);
    });

    it('[AC-GEN-018] retries on 503 and gives up on quota errors', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      }) as any);

      mockedAxios.post
        .mockRejectedValueOnce({ response: { status: 503 }, message: 'unavailable' })
        .mockResolvedValueOnce(openaiReply(JSON.stringify({ 'white-bg': 'recovered prompt long enough' })));
      const prompts = await service.generateAllStylePrompts('x', [GENERATION_STYLES[0]]);
      expect(prompts.get('white-bg')).toBe('recovered prompt long enough');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);

      mockedAxios.post.mockRejectedValueOnce({
        response: { status: 429, data: { error: { message: 'You exceeded your current quota' } } },
      });
      await expect(service.generateCustomPrompt('x', 'y')).rejects.toThrow(/quota/);
      (global.setTimeout as unknown as jest.SpyInstance).mockRestore();
    });
  });

  describe('generateImage', () => {
    const successResponse = {
      response: {
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ inlineData: { data: 'AAAA', mimeType: 'image/png' } }] } },
        ],
      },
    };

    it('[AC-GEN-014] sends the original image, the prompt with constraints and a 1:1 aspect ratio hint', async () => {
      generateContent.mockResolvedValueOnce(successResponse);

      const result = await service.generateImage('b64', 'image/jpeg', 'scene prompt');

      expect(result).toEqual({ base64: 'AAAA', mimeType: 'image/png' });
      const req = generateContent.mock.calls[0][0];
      expect(req.generationConfig).toEqual({ responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } });
      expect(req.contents[0].parts[0]).toEqual({ inlineData: { data: 'b64', mimeType: 'image/jpeg' } });
      expect(req.contents[0].parts[1].text).toContain('scene prompt');
      expect(req.contents[0].parts[1].text).toContain('MANDATORY PRODUCT INTEGRITY');
    });

    it('adds the reference image with an instruction not to copy objects from it', async () => {
      generateContent.mockResolvedValueOnce(successResponse);
      await service.generateImage('b64', 'image/jpeg', 'p', 'ref64', 'image/png');
      const parts = generateContent.mock.calls[0][0].contents[0].parts;
      expect(parts).toHaveLength(4);
      expect(parts[1]).toEqual({ inlineData: { data: 'ref64', mimeType: 'image/png' } });
      expect(parts[2].text).toMatch(/STYLE REFERENCE only/);
    });

    it('[AC-GEN-015] retries without imageConfig when the API rejects it and remembers that', async () => {
      generateContent
        .mockRejectedValueOnce(new Error('[400] Invalid JSON payload received. Unknown name "imageConfig"'))
        .mockResolvedValueOnce(successResponse)
        .mockResolvedValueOnce(successResponse);

      await service.generateImage('b64', 'image/jpeg', 'p');
      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(generateContent.mock.calls[1][0].generationConfig).toEqual({ responseModalities: ['IMAGE'] });

      await service.generateImage('b64', 'image/jpeg', 'p');
      expect(generateContent.mock.calls[2][0].generationConfig).toEqual({ responseModalities: ['IMAGE'] });
    });

    it('[AC-GEN-016] throws a descriptive error when the model returns no image (e.g. safety block)', async () => {
      generateContent.mockResolvedValueOnce({
        response: { candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'refused' }] } }] },
      });
      await expect(service.generateImage('b64', 'image/jpeg', 'p')).rejects.toThrow(/no image data.*SAFETY/);
    });
  });
});
