import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import {
  AiBillingError,
  GeminiService,
  buildImagePrompt,
  buildOfferCopyPrompt,
  fallbackCustomPrompt,
  fallbackReworkPrompt,
  isGeminiBillingError,
  isOpenAiBillingError,
  PRODUCT_INTEGRITY_CONSTRAINTS,
} from './gemini.service';
import { MailService } from '../mail/mail.service';
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

  describe('buildOfferCopyPrompt', () => {
    it('[AC-DESC-014] names the chosen platform and its title limit; generic by default', () => {
      const ebay = buildOfferCopyPrompt('ebay');
      expect(ebay).toContain('eBay');
      expect(ebay).toContain('maksymalnie 80 znaków');
      expect(buildOfferCopyPrompt('vinted')).toContain('maksymalnie 50 znaków');
      const generic = buildOfferCopyPrompt();
      expect(generic).toContain('sklepie internetowym');
      expect(generic).toContain('maksymalnie 75 znaków');
      for (const id of ['generic', 'olx', 'vinted', 'ebay', 'amazon'] as const) {
        expect(buildOfferCopyPrompt(id)).not.toMatch(/allegro/i);
      }
    });
  });

  describe('buildImagePrompt', () => {
    it('[AC-GEN-017] appends the English product-integrity and marketplace output constraints', () => {
      const prompt = buildImagePrompt('  A product on a wooden table  ');
      expect(prompt.startsWith('A product on a wooden table')).toBe(true);
      expect(prompt).toContain(PRODUCT_INTEGRITY_CONSTRAINTS);
      expect(prompt).toMatch(/do NOT add any text/);
      expect(prompt).toMatch(/square 1:1/);
      expect(prompt).not.toMatch(/allegro/i);
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

  describe('OpenAI billing errors (AC-GEN-030)', () => {
    const NO_CREDITS = {
      response: {
        status: 429,
        data: {
          error: {
            message: 'You have no credits remaining. Add credits to continue using the API.',
            type: 'insufficient_quota',
            code: 'insufficient_quota',
          },
        },
      },
    };
    let mail: { send: jest.Mock };
    let billingService: GeminiService;

    beforeEach(() => {
      jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      }) as any);
      mail = { send: jest.fn().mockResolvedValue(undefined) };
      billingService = new GeminiService(
        configWith({ OPENAI_API_KEY: 'k', GEMINI_API_KEY: 'g', ADMIN_EMAILS: 'Ops@Example.com, boss@example.com' }),
        mail as unknown as MailService,
      );
    });
    afterEach(() => (global.setTimeout as unknown as jest.SpyInstance).mockRestore());

    it('[AC-GEN-030] tells billing refusals apart from a plain rate limit', () => {
      expect(isOpenAiBillingError(429, { code: 'insufficient_quota' })).toBe(true);
      expect(isOpenAiBillingError(429, { type: 'insufficient_quota', message: 'x' })).toBe(true);
      expect(isOpenAiBillingError(429, { message: 'You have no credits remaining.' })).toBe(true);
      expect(isOpenAiBillingError(429, { message: 'You exceeded your current quota' })).toBe(true);
      expect(isOpenAiBillingError(402, { message: 'Billing hard limit reached' })).toBe(true);
      expect(
        isOpenAiBillingError(429, { message: 'Rate limit reached for requests', code: 'rate_limit_exceeded' }),
      ).toBe(false);
      expect(isOpenAiBillingError(500, { message: 'quota' })).toBe(false);
      expect(isOpenAiBillingError(undefined, undefined)).toBe(false);
    });

    it('[AC-GEN-030] does not retry "no credits", throws AiBillingError and e-mails every admin once', async () => {
      mockedAxios.post.mockRejectedValue(NO_CREDITS);
      const error = await billingService.generateImageDescription('b64', 'image/png').catch((e) => e);
      expect(error).toBeInstanceOf(AiBillingError);
      expect(error.message).toMatch(/no credits remaining/);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      await Promise.resolve();
      expect(mail.send).toHaveBeenCalledTimes(2);
      expect(mail.send.mock.calls.map((c) => c[0].to)).toEqual(['ops@example.com', 'boss@example.com']);
      expect(mail.send.mock.calls[0][0].subject).toBe('[AllGrafika] Brak środków w OpenAI');
      expect(mail.send.mock.calls[0][0].text).toContain('generateImageDescription');
      expect(mail.send.mock.calls[0][0].text).toContain('platform.openai.com/settings/organization/billing');

      // Further failures within 6 h: no more e-mails.
      await expect(billingService.generateCustomPrompt('x', 'y')).rejects.toBeInstanceOf(AiBillingError);
      await expect(billingService.generateOfferCopy({ sellerNotes: 'kubek' })).rejects.toBeInstanceOf(AiBillingError);
      expect(mail.send).toHaveBeenCalledTimes(2);
      mockedAxios.post.mockReset();
    });

    it('[AC-GEN-030] alerts again after 6 hours', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000_000);
      mockedAxios.post.mockRejectedValue(NO_CREDITS);
      await billingService.generateCustomPrompt('x', 'y').catch(() => undefined);
      now.mockReturnValue(1_000_000_000 + 6 * 60 * 60_000 - 1);
      await billingService.generateCustomPrompt('x', 'y').catch(() => undefined);
      await Promise.resolve();
      expect(mail.send).toHaveBeenCalledTimes(2);
      now.mockReturnValue(1_000_000_000 + 6 * 60 * 60_000);
      await billingService.generateCustomPrompt('x', 'y').catch(() => undefined);
      await Promise.resolve();
      expect(mail.send).toHaveBeenCalledTimes(4);
      now.mockRestore();
      mockedAxios.post.mockReset();
    });

    it('[AC-GEN-030] a mail failure or missing ADMIN_EMAILS never hides the original error', async () => {
      mail.send.mockRejectedValue(new Error('smtp down'));
      mockedAxios.post.mockRejectedValue(NO_CREDITS);
      await expect(billingService.generateCustomPrompt('x', 'y')).rejects.toBeInstanceOf(AiBillingError);

      const noAdmins = new GeminiService(configWith({ OPENAI_API_KEY: 'k' }), mail as unknown as MailService);
      mail.send.mockClear();
      await expect(noAdmins.generateCustomPrompt('x', 'y')).rejects.toBeInstanceOf(AiBillingError);
      const noMail = new GeminiService(configWith({ OPENAI_API_KEY: 'k', ADMIN_EMAILS: 'a@b.pl' }));
      await expect(noMail.generateCustomPrompt('x', 'y')).rejects.toBeInstanceOf(AiBillingError);
      expect(mail.send).not.toHaveBeenCalled();
      mockedAxios.post.mockReset();
    });

    it('[AC-GEN-030] a plain rate limit is still retried and no alert is sent', async () => {
      mockedAxios.post
        .mockRejectedValueOnce({
          response: { status: 429, data: { error: { message: 'Rate limit reached', code: 'rate_limit_exceeded' } } },
        })
        .mockResolvedValueOnce(openaiReply('scene prompt'));
      await expect(billingService.generateCustomPrompt('x', 'y')).resolves.toBe('scene prompt');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(mail.send).not.toHaveBeenCalled();
    });
  });

  describe('Gemini billing errors (AC-GEN-032)', () => {
    const DEPLETED = Object.assign(
      new Error(
        '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/x:generateContent: ' +
          '[402 Payment Required] Your prepayment credits are depleted. Please go to AI Studio to manage your project and billing.',
      ),
      { status: 402 },
    );
    const okImage = {
      response: {
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ inlineData: { data: 'AAAA', mimeType: 'image/png' } }] } },
        ],
      },
    };
    let mail: { send: jest.Mock };
    let svc: GeminiService;

    beforeEach(() => {
      jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      }) as any);
      mail = { send: jest.fn().mockResolvedValue(undefined) };
      svc = new GeminiService(
        configWith({ OPENAI_API_KEY: 'k', GEMINI_API_KEY: 'g', ADMIN_EMAILS: 'ops@example.com' }),
        mail as unknown as MailService,
      );
    });
    afterEach(() => (global.setTimeout as unknown as jest.SpyInstance).mockRestore());

    it('[AC-GEN-032] recognises depleted prepaid credits but not the per-minute rate limit', () => {
      expect(isGeminiBillingError(DEPLETED)).toBe(true);
      expect(isGeminiBillingError({ status: 402, message: 'Payment Required' })).toBe(true);
      expect(isGeminiBillingError({ message: '[402 Payment Required] something' })).toBe(true);
      expect(isGeminiBillingError({ message: 'Billing account is disabled for this project' })).toBe(true);
      expect(
        isGeminiBillingError({
          status: 429,
          message: '[429 Too Many Requests] Resource has been exhausted (e.g. check quota). RESOURCE_EXHAUSTED',
        }),
      ).toBe(false);
      expect(isGeminiBillingError({ message: '[503 Service Unavailable] The model is overloaded' })).toBe(false);
      expect(isGeminiBillingError(undefined)).toBe(false);
    });

    it('[AC-GEN-032] does not retry depleted credits, throws AiBillingError and e-mails "Brak środków w Gemini" once', async () => {
      generateContent.mockRejectedValue(DEPLETED);
      const error = await svc.generateImage('b64', 'image/png', 'scene').catch((e) => e);
      expect(error).toBeInstanceOf(AiBillingError);
      expect(error.message).toMatch(/prepayment credits are depleted/);
      expect(generateContent).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(mail.send).toHaveBeenCalledTimes(1);
      expect(mail.send.mock.calls[0][0]).toMatchObject({
        to: 'ops@example.com',
        subject: '[AllGrafika] Brak środków w Gemini',
      });
      expect(mail.send.mock.calls[0][0].text).toContain('https://ai.studio/projects');
      expect(mail.send.mock.calls[0][0].text).toContain('kredyty za nieudane grafiki wracają');

      await expect(svc.generateImage('b64', 'image/png', 'scene 2')).rejects.toBeInstanceOf(AiBillingError);
      await Promise.resolve();
      expect(mail.send).toHaveBeenCalledTimes(1);
      generateContent.mockReset();
    });

    it('[AC-GEN-032] Gemini and OpenAI alerts are throttled independently', async () => {
      generateContent.mockRejectedValue(DEPLETED);
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 429,
          data: { error: { message: 'You have no credits remaining.', code: 'insufficient_quota' } },
        },
      });
      await svc.generateImage('b64', 'image/png', 'scene').catch(() => undefined);
      await svc.generateCustomPrompt('x', 'y').catch(() => undefined);
      await Promise.resolve();
      expect(mail.send.mock.calls.map((c) => c[0].subject).sort()).toEqual([
        '[AllGrafika] Brak środków w Gemini',
        '[AllGrafika] Brak środków w OpenAI',
      ]);
      generateContent.mockReset();
      mockedAxios.post.mockReset();
    });

    it('[AC-GEN-032] a 429 RESOURCE_EXHAUSTED rate limit is still retried without an alert', async () => {
      generateContent
        .mockRejectedValueOnce(
          Object.assign(
            new Error('[429 Too Many Requests] Resource has been exhausted (e.g. check quota). RESOURCE_EXHAUSTED'),
            { status: 429 },
          ),
        )
        .mockResolvedValueOnce(okImage);
      await expect(svc.generateImage('b64', 'image/png', 'scene')).resolves.toEqual({
        base64: 'AAAA',
        mimeType: 'image/png',
      });
      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(mail.send).not.toHaveBeenCalled();
      generateContent.mockReset();
    });
  });

  describe('fallback prompts (AC-GEN-031)', () => {
    it('[AC-GEN-031] wrap the user text in English scene / edit instructions', () => {
      const custom = fallbackCustomPrompt('  na drewnianym stole  ');
      expect(custom).toContain('"na drewnianym stole"');
      expect(custom).toMatch(/never the product/);
      expect(custom).toMatch(/no text, no watermark/);
      const rework = fallbackReworkPrompt('jaśniejsze tło');
      expect(rework).toContain('"jaśniejsze tło"');
      expect(rework).toMatch(/Edit the FIRST image/);
      expect(rework).toMatch(/SECOND image/);
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
