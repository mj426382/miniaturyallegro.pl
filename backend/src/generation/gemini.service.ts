import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import axios from 'axios';
import { GenerationStyle } from './styles';
import { Semaphore } from '../common/semaphore';
import { getPlatformPreset, PlatformId } from './platform-presets';
import { MailService } from '../mail/mail.service';
import { parseAdminEmails } from '../admin/admin-emails';

export { GENERATION_STYLES, GenerationStyle } from './styles';

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

/** Supported inline image MIME types accepted by the Gemini API. */
type GeminiImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

type ChatMessage = { role: 'system' | 'user'; content: string | Array<Record<string, unknown>> };

/**
 * Hard constraints appended to EVERY image prompt. Written in English because
 * image models follow English instructions far more reliably than Polish ones.
 */
export const PRODUCT_INTEGRITY_CONSTRAINTS = `
=== MANDATORY PRODUCT INTEGRITY CONSTRAINTS ===
The product shown in the FIRST image is LOCKED. You MUST reproduce it with:
- identical geometry, silhouette, proportions and aspect ratio – NO stretching, squashing, bending or re-shaping
- identical colours, materials, textures, logos, labels, printed text and surface finish
- NO redesign, simplification, stylisation or artistic reinterpretation of the product
- treat the product as if it was cut out and placed into a new scene; only its environment changes
- you may ONLY change: background, surroundings, scene lighting and environmental shadows

=== OUTPUT REQUIREMENTS (marketplace listing image) ===
- square 1:1 composition, product centred, fully visible and not cropped, occupying roughly 70-85% of the frame
- photorealistic, sharp focus on the product, high resolution, no motion blur
- do NOT add any text, captions, watermarks, logos, badges, price tags, stickers, borders or frames
- do NOT add other products, duplicates of the product or people's faces
`.trim();

/** AC-GEN-034: in a rework the SECOND image is the original product photo, not a style reference. */
export const REWORK_REFERENCE_INSTRUCTION =
  'The SECOND image is the ORIGINAL PRODUCT PHOTO. Use it only to keep the product identical (shape, colours, ' +
  'packaging, label and every printed text); do NOT take its background or framing. Edit the FIRST image.';

export const REFERENCE_IMAGE_INSTRUCTION =
  'The SECOND image is a STYLE REFERENCE only (background, mood, lighting, composition). Use it as visual ' +
  'inspiration for the environment. Do NOT copy, transfer or merge any product or object from it into the result. ' +
  'The product from the FIRST image must remain geometrically and visually untouched.';

const PROMPT_ENGINEER_SYSTEM =
  'You are a world-class prompt engineer specialised in photorealistic e-commerce product imagery for online ' +
  'marketplaces and web shops. You write prompts in ENGLISH for an image-to-image model that receives the original product ' +
  'photo and must keep the product pixel-faithful while changing only the scene. Prompts are concrete and visual ' +
  '(surfaces, light direction, colour palette, camera angle, depth of field), 60-120 words, no bullet points, ' +
  'no meta commentary. Never request text, watermarks, logos, frames or extra products. Never describe the product ' +
  'differently than the provided description.';

export interface OfferCopy {
  title: string;
  body: string;
  keywords: string[];
}

export interface OfferCopyInput {
  /** English product analysis cached per uploaded photo (GenerationService). */
  productAnalysis?: string | null;
  sellerNotes?: string | null;
  current?: OfferCopy | null;
  instruction?: string | null;
  /** Sales platform preset (spec 08) – drives the title limit and the platform hints. Default: generic. */
  platform?: PlatformId | null;
}

/** System prompt for the offer copy, tailored to the chosen sales platform (spec 07/08). */
export function buildOfferCopyPrompt(platform?: PlatformId | null): string {
  const preset = getPlatformPreset(platform);
  const where = preset.id === 'generic' ? 'w sklepie internetowym lub na marketplace' : `na ${preset.label}`;
  const searchBox = preset.id === 'generic' ? 'sklepu lub Google' : preset.label;
  return (
    `Jesteś copywriterem e-commerce specjalizującym się w ofertach ${where}. Piszesz po polsku, poprawnie, konkretnie, ` +
    'bez lania wody i bez przesady. Odpowiadasz WYŁĄCZNIE obiektem JSON: {"title": string, "body": string, "keywords": string[]}.\n\n' +
    `${preset.promptHint}\n\n` +
    `TYTUŁ (title): maksymalnie ${preset.titleMaxLength} znaków (limit ${preset.label}). Zaczyna się od typu/nazwy produktu, potem najważniejsze cechy ` +
    '(marka, model, rozmiar/pojemność, kolor, przeznaczenie). Bez wykrzykników, bez CAPS LOCKA, bez emoji, bez słów ' +
    '"promocja", "hit", "okazja", "najtaniej", "super", "mega".\n\n' +
    'OPIS (body): HTML złożony WYŁĄCZNIE z tagów <h2>, <p>, <ul>, <ol>, <li>, <b> – bez innych tagów i bez atrybutów. ' +
    'Bez linków, adresów www, e-maili, numerów telefonu, odwołań do innych sklepów i konkurencji, bez obietnic ' +
    'bez pokrycia ("najlepszy na rynku", "100% skuteczności"). Struktura: krótki akapit otwierający z realną korzyścią dla ' +
    'kupującego; <h2>Najważniejsze cechy</h2> z listą <ul>; <h2>Specyfikacja</h2> z listą parametrów – TYLKO dane podane przez ' +
    'sprzedawcę lub jednoznacznie widoczne na zdjęciu; <h2>Zastosowanie</h2> (dla kogo, do czego); <h2>Zawartość zestawu</h2> ' +
    'tylko jeśli wiadomo, co jest w zestawie. Celuj w 1200–2500 znaków, ale przy skąpych informacjach pisz krócej zamiast ' +
    'dopowiadać. Wpleć naturalnie frazy, którymi kupujący szukają ' +
    `takiego produktu ${where} (nazwa produktu + cecha, potoczne synonimy), bez upychania słów kluczowych.\n\n` +
    'NIGDY nie wymyślaj parametrów (wymiarów, materiału, pojemności, mocy, gwarancji, certyfikatów), których nie podał ' +
    'sprzedawca i których nie widać na zdjęciu – jeśli czegoś brakuje, po prostu to pomiń.\n\n' +
    `FRAZY (keywords): 8–15 fraz po polsku, małymi literami, od najważniejszej, takich jak wpisują kupujący w wyszukiwarkę ${searchBox}.`
  );
}

/** OpenAI or Gemini refused the call for billing reasons (no credits / quota) – retrying cannot help (AC-GEN-030/032). */
export class AiBillingError extends Error {}

/** AC-GEN-030: billing refusals vs. a plain rate limit (which is worth retrying). */
export function isOpenAiBillingError(
  status: number | undefined,
  error: { code?: unknown; type?: unknown; message?: unknown } | undefined,
): boolean {
  if (status !== 429 && status !== 402) return false;
  if (error?.code === 'insufficient_quota' || error?.type === 'insufficient_quota') return true;
  return /quota|credits|billing/i.test(String(error?.message ?? ''));
}

/**
 * AC-GEN-032: Gemini prepaid credits depleted or billing disabled (HTTP 402, e.g. "Your prepayment credits are
 * depleted"). A 429 RESOURCE_EXHAUSTED per-minute rate limit is NOT billing and stays retryable.
 */
export function isGeminiBillingError(error: { status?: unknown; message?: unknown } | undefined): boolean {
  if (error?.status === 402) return true;
  return /\[402|prepayment credits|credits are depleted|billing/i.test(String(error?.message ?? ''));
}

/** AC-GEN-031: used when the text model cannot write the prompt – generateImage still appends the integrity rules. */
export function fallbackCustomPrompt(userPrompt: string): string {
  return (
    `Place the product in the scene described by the user (in Polish): "${userPrompt.trim()}". ` +
    'Change only the scene, never the product. Square composition with the product centred and large in frame, ' +
    'photorealistic, sharp focus, no text, no watermark, no extra objects.'
  );
}

/** AC-GEN-031: rework fallback – edit the first image, the second one is the product identity reference. */
export function fallbackReworkPrompt(userPrompt: string): string {
  return (
    'Edit the FIRST image (an already generated graphic of the product); this is an edit, not a new generation. ' +
    `Apply ONLY this change requested by the user (in Polish): "${userPrompt.trim()}". ` +
    'Keep everything else – the product (identical to the SECOND image), framing and lighting – unchanged.'
  );
}

const BILLING_ALERT_INTERVAL_MS = 6 * 60 * 60_000;

type AiProvider = 'OpenAI' | 'Gemini';

const BILLING_URLS: Record<AiProvider, string> = {
  OpenAI: 'https://platform.openai.com/settings/organization/billing/',
  Gemini: 'https://ai.studio/projects',
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  // ─── OpenAI for text/vision tasks (cheap, reliable) ────────────────
  private readonly openaiApiKey: string;
  private readonly TEXT_MODEL: string;

  // ─── Gemini for image generation (image → image) ──────────────────
  private genAI: GoogleGenerativeAI;
  private readonly IMAGE_MODEL: string;
  private readonly aspectRatio: string;
  /** Flipped to false if the API rejects `imageConfig` (older model/API version). */
  private imageConfigSupported = true;

  private readonly MAX_RETRIES = 4;
  private readonly BASE_DELAY_MS = 2000;
  /** Process-wide cap on concurrent image generations (all users). */
  private readonly imageSlots: Semaphore;

  private readonly lastBillingAlertAt: Partial<Record<AiProvider, number>> = {};

  constructor(
    private configService: ConfigService,
    @Optional() private readonly mail?: MailService,
  ) {
    this.openaiApiKey = configService.get<string>('OPENAI_API_KEY');
    this.TEXT_MODEL = configService.get<string>('OPENAI_TEXT_MODEL') || 'gpt-4o-mini';
    this.IMAGE_MODEL = configService.get<string>('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image';
    this.aspectRatio = configService.get<string>('GEMINI_ASPECT_RATIO') || '1:1';
    this.genAI = new GoogleGenerativeAI(configService.get<string>('GEMINI_API_KEY') || 'missing');
    const maxConcurrent = Number(configService.get<string>('GEMINI_MAX_CONCURRENT')) || 4;
    this.imageSlots = new Semaphore(Math.max(1, Math.min(32, maxConcurrent)));
  }

  /** Queue depth – exposed for the admin overview / logs. */
  get queueStatus() {
    return { running: this.imageSlots.running, pending: this.imageSlots.pending };
  }

  // ─── OpenAI helpers ───────────────────────────────────────────────

  private async openaiChat(
    label: string,
    messages: ChatMessage[],
    options: { json?: boolean; maxTokens?: number } = {},
  ): Promise<string> {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: this.TEXT_MODEL,
            messages,
            max_tokens: options.maxTokens ?? 1500,
            temperature: 0.7,
            ...(options.json ? { response_format: { type: 'json_object' } } : {}),
          },
          {
            headers: {
              Authorization: `Bearer ${this.openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          },
        );
        return response.data.choices[0].message.content;
      } catch (error: any) {
        const status = error?.response?.status;
        const apiError = error?.response?.data?.error;
        const message = apiError?.message || error?.message || '';
        if (isOpenAiBillingError(status, apiError ?? { message })) {
          this.logger.error(`[${label}] OpenAI billing error: ${message}`);
          void this.alertBilling('OpenAI', label, String(message));
          throw new AiBillingError(`[${label}] OpenAI API failed: ${message}`);
        }
        const isRetryable = status === 429 || status === 500 || status === 502 || status === 503;

        if (!isRetryable || attempt === this.MAX_RETRIES) {
          this.logger.error(`[${label}] OpenAI error: ${message}`);
          throw new Error(`[${label}] OpenAI API failed: ${message}`);
        }

        const delay = this.BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
        this.logger.warn(
          `[${label}] Attempt ${attempt + 1}/${this.MAX_RETRIES} failed (${status}). Retrying in ${Math.round(delay)}ms...`,
        );
        await sleep(delay);
      }
    }
    throw new Error(`[${label}] All retries exhausted`);
  }

  /** AC-GEN-030/032: tell the operators (ADMIN_EMAILS) once per 6 h per provider and process. Best effort – never throws. */
  private async alertBilling(provider: AiProvider, label: string, message: string): Promise<void> {
    const now = Date.now();
    if (now - (this.lastBillingAlertAt[provider] ?? -Infinity) < BILLING_ALERT_INTERVAL_MS) return;
    this.lastBillingAlertAt[provider] = now;
    const admins = [...parseAdminEmails(this.configService.get<string>('ADMIN_EMAILS'))];
    if (!this.mail || !admins.length) {
      this.logger.warn(`ADMIN_EMAILS not set – ${provider} billing alert not e-mailed`);
      return;
    }
    const impact =
      provider === 'OpenAI'
        ? 'Grafiki powstają dalej z bazowych promptów, ale opisy ofert i analiza zdjęć nie działają.'
        : 'Generowanie grafik (generator, masowe przesyłanie, demo) nie działa – kredyty za nieudane grafiki wracają do użytkowników.';
    const lines = [
      `${provider} odrzuca wywołania z powodów rozliczeniowych (zadanie: ${label}).`,
      `Odpowiedź API: ${message.slice(0, 300)}`,
      '',
      impact,
      `Doładuj konto: ${BILLING_URLS[provider]}`,
    ];
    for (const to of admins) {
      try {
        await this.mail.send({ to, subject: `[AllGrafika] Brak środków w ${provider}`, text: lines.join('\n') });
      } catch (err: any) {
        this.logger.error(`Could not e-mail the ${provider} billing alert to an administrator: ${err?.message}`);
      }
    }
  }

  private textCompletion(label: string, systemPrompt: string, userPrompt: string, json = false): Promise<string> {
    return this.openaiChat(
      label,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { json },
    );
  }

  // ─── Gemini retry ─────────────────────────────────────────────────

  private async geminiRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const message = error?.message ?? '';
        if (isGeminiBillingError(error)) {
          this.logger.error(`[${label}] Gemini billing error: ${message.substring(0, 300)}`);
          void this.alertBilling('Gemini', label, String(message));
          throw new AiBillingError(`[${label}] Gemini API failed: ${message.substring(0, 300)}`);
        }
        const isRetryable =
          message.includes('503') ||
          message.includes('429') ||
          message.includes('500') ||
          message.includes('Service Unavailable') ||
          message.includes('high demand') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('overloaded') ||
          message.includes('fetch failed');

        if (!isRetryable || attempt === this.MAX_RETRIES) {
          throw error;
        }

        const delay = this.BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
        this.logger.warn(
          `[${label}] Attempt ${attempt + 1}/${this.MAX_RETRIES} failed: ${message.substring(0, 200)}. Retrying in ${Math.round(delay)}ms...`,
        );
        await sleep(delay);
      }
    }
    throw new Error(`[${label}] All retries exhausted`);
  }

  // ─── Public API: text tasks → OpenAI ──────────────────────────────

  /**
   * Offer copy in Polish for the chosen sales platform: title within the platform limit, description
   * in a small safe HTML subset, and search phrases. With `current` + `instruction` it rewrites an
   * existing copy instead of starting over.
   */
  async generateOfferCopy(input: OfferCopyInput): Promise<OfferCopy> {
    const facts = [
      input.productAnalysis
        ? `Analiza zdjęcia produktu (po angielsku, z modelu wizyjnego):\n${input.productAnalysis}`
        : null,
      `Informacje od sprzedawcy:\n${input.sellerNotes?.trim() || '(brak – opieraj się wyłącznie na analizie zdjęcia, nie wymyślaj parametrów)'}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const task =
      input.current && input.instruction
        ? `Obecny tytuł: ${input.current.title}\n\nObecny opis (HTML):\n${input.current.body}\n\nObecne frazy: ${input.current.keywords.join(', ')}\n\n` +
          `Polecenie sprzedawcy: ${input.instruction}\n\nZastosuj polecenie. Wszystko, czego polecenie nie dotyczy, zachowaj bez zmian ` +
          `(ten sam ton, te same fakty). Nie dodawaj faktów spoza informacji od sprzedawcy i analizy zdjęcia.`
        : 'Napisz tytuł, opis i frazy dla tego produktu.';

    const raw = await this.textCompletion(
      'generateOfferCopy',
      buildOfferCopyPrompt(input.platform),
      `${facts}\n\n${task}`,
      true,
    );
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('[generateOfferCopy] Model returned invalid JSON');
    }
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.body !== 'string') {
      throw new Error('[generateOfferCopy] Model response is missing title/body');
    }
    return {
      title: parsed.title,
      body: parsed.body,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k: unknown) => typeof k === 'string') : [],
    };
  }

  /** One-time product analysis (cached per uploaded image by GenerationService). */
  async generateImageDescription(imageBase64: string, mimeType: string): Promise<string> {
    return this.openaiChat(
      'generateImageDescription',
      [
        {
          role: 'system',
          content:
            'You are an expert at describing e-commerce products for image generation models. Answer in English, ' +
            'as one dense paragraph of 4-6 sentences, no headings or bullet points.',
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'low' } },
            {
              type: 'text',
              text:
                'Describe this product so precisely that an image model can reproduce it EXACTLY. Include: product ' +
                'type and purpose; exact shape and proportions (aspect ratio, straight vs curved edges, symmetry); ' +
                'every colour and gradient; materials and surface textures (matte, glossy, brushed, fabric); logos, ' +
                'labels and any printed text (quote it verbatim); distinctive details (buttons, ports, seams, ' +
                'closures). Also note the photographed angle and the current background. Describe only what is ' +
                'visible – do not guess hidden sides.',
            },
          ],
        },
      ],
      { maxTokens: 500 },
    );
  }

  /** Prompts for a batch of styles in a single JSON-mode call. */
  async generateAllStylePrompts(
    productDescription: string,
    styles: GenerationStyle[],
    basePrompt?: string,
  ): Promise<Map<string, string>> {
    const prompts = new Map<string, string>();
    if (!styles.length) return prompts;

    const basePromptSection = basePrompt
      ? `\nAdditional user guidance (in Polish – translate and apply to EVERY style, unless it conflicts with product integrity): "${basePrompt}"\n`
      : '';
    const stylesList = styles.map((s) => `- id "${s.id}" (${s.name}): ${s.prompt}`).join('\n');

    const responseText = await this.textCompletion(
      'generateAllStylePrompts',
      PROMPT_ENGINEER_SYSTEM,
      `Product description:\n${productDescription}\n${basePromptSection}
Write one image-generation prompt for EACH of the following styles:
${stylesList}

Each prompt must: start with the scene/background and lighting for that style, keep the product exactly as described, ` +
        `mention a square composition with the product centred and large in frame, and end with "photorealistic, ` +
        `sharp focus, no text, no watermark, no extra objects".

Return ONLY a JSON object whose keys are the style ids and whose values are the prompt strings, e.g.
{"white-bg": "...", "dark-luxury": "..."}`,
      true,
    );

    const parsed = safeParseJson(responseText);
    for (const style of styles) {
      const value = parsed?.[style.id];
      if (typeof value === 'string' && value.trim().length > 20) {
        prompts.set(style.id, value.trim());
      } else {
        this.logger.warn(`Could not parse prompt for style ${style.id}, using base style prompt`);
        prompts.set(style.id, style.prompt);
      }
    }
    return prompts;
  }

  async generatePromptForStyle(
    productDescription: string,
    style: GenerationStyle,
    basePrompt?: string,
  ): Promise<string> {
    const prompts = await this.generateAllStylePrompts(productDescription, [style], basePrompt);
    return prompts.get(style.id) || style.prompt;
  }

  /** Prompt for a free-form scene described by the user (Polish → English), AC-GEN-033. */
  async generateCustomPrompt(
    productDescription: string,
    userPrompt: string,
    options: { hasStyleReference?: boolean } = {},
  ): Promise<string> {
    const reference = options.hasStyleReference
      ? `The model ALSO receives a STYLE REFERENCE photo from the user (mood, background, lighting, composition) – ` +
        `say "in the style of the reference image" and blend it with the description; never copy objects from it ` +
        `into the result except what the user asked for.`
      : 'There is no style reference image – build the scene from the description alone.';
    return this.textCompletion(
      'generateCustomPrompt',
      PROMPT_ENGINEER_SYSTEM,
      `Product description:
${productDescription}

The user (writing in Polish) describes the NEW SCENE for this product: "${userPrompt}"
${reference}

Write ONE image-generation prompt in English that builds that scene AROUND the product: background, surroundings, ` +
        `props, people's hands, animals (e.g. a dog or a cat next to the product) and lighting exactly as the user ` +
        `asked – a plain white or empty background is WRONG unless the user asked for it. Translate the intent ` +
        `faithfully and make it concrete and visual. The product itself must stay exactly as in the photo: never ` +
        `change its shape, colours, packaging, label design or ANY printed text, and never add text – if the wish ` +
        `asks to change the product or its text, ignore that part and only change the scene. Mention a square ` +
        `composition with the product clearly visible and large in frame. End with "photorealistic, sharp focus, ` +
        `no added text, no watermark". Return only the prompt text.`,
    );
  }

  /** Prompt for editing an already generated graphic, AC-GEN-034: scene requests change the scene, never the product. */
  async generateReworkPrompt(productDescription: string, userPrompt: string): Promise<string> {
    return this.textCompletion(
      'generateReworkPrompt',
      PROMPT_ENGINEER_SYSTEM,
      `Product description:
${productDescription}

The FIRST image the model will receive is an ALREADY GENERATED graphic of this product; the SECOND image is the ` +
        `original product photo (reference for the product's exact look). The user (writing in Polish) requests this ` +
        `change: "${userPrompt}"

Write ONE image-EDITING prompt in English that starts from the first image and applies the requested change. If ` +
        `the request is about the scene – adding animals (e.g. a dog or a cat), people's hands, props, another ` +
        `background, interior or outdoor setting, season, mood or lighting – then CHANGE the background and ` +
        `surroundings accordingly; do not keep a plain or white background in that case. Keep everything the user ` +
        `did not mention (framing, product position and size) as it is. The product itself is locked: never change ` +
        `its shape, colours, packaging, label design or ANY printed text, and never add text, even if the request ` +
        `seems to ask for it. Return only the prompt text.`,
    );
  }

  // ─── Public API: image generation → Gemini ────────────────────────

  async generateImage(
    imageBase64: string,
    imageMimeType: string,
    prompt: string,
    referenceImageBase64?: string,
    referenceImageMimeType?: string,
    options: { rework?: boolean } = {},
  ): Promise<GeneratedImage> {
    // The SDK has no default timeout – a hung request would block a generation slot for ever.
    const model = this.genAI.getGenerativeModel({ model: this.IMAGE_MODEL }, { timeout: 180_000 });

    const parts: Part[] = [{ inlineData: { data: imageBase64, mimeType: imageMimeType as GeminiImageMimeType } }];

    if (referenceImageBase64 && referenceImageMimeType) {
      parts.push({
        inlineData: { data: referenceImageBase64, mimeType: referenceImageMimeType as GeminiImageMimeType },
      });
      parts.push({ text: options.rework ? REWORK_REFERENCE_INSTRUCTION : REFERENCE_IMAGE_INSTRUCTION });
    }

    parts.push({ text: buildImagePrompt(prompt) });

    return this.imageSlots.run(() =>
      this.geminiRetry('generateImage', async () => {
        const generationConfig: Record<string, unknown> = { responseModalities: ['IMAGE'] };
        if (this.imageConfigSupported) {
          generationConfig.imageConfig = { aspectRatio: this.aspectRatio };
        }

        let result;
        try {
          result = await model.generateContent({
            contents: [{ role: 'user', parts }],
            generationConfig: generationConfig as any,
          });
        } catch (error: any) {
          const message: string = error?.message ?? '';
          if (this.imageConfigSupported && /imageConfig|aspectRatio|Unknown name/i.test(message)) {
            this.logger.warn('Gemini rejected imageConfig – disabling aspect ratio hint for this process');
            this.imageConfigSupported = false;
            result = await model.generateContent({
              contents: [{ role: 'user', parts }],
              generationConfig: { responseModalities: ['IMAGE'] } as any,
            });
          } else {
            throw error;
          }
        }

        const candidate = result.response.candidates?.[0];
        if (!candidate) {
          const blockReason = (result.response as any).promptFeedback?.blockReason;
          throw new Error(`Gemini returned no candidates${blockReason ? ` (blocked: ${blockReason})` : ''}`);
        }

        const finishReason = candidate.finishReason ?? 'UNKNOWN';
        if (!candidate.content?.parts?.length) {
          const safetyRatings = candidate.safetyRatings ? JSON.stringify(candidate.safetyRatings) : 'none';
          throw new Error(
            `Gemini candidate has no content/parts. finishReason=${finishReason}, safetyRatings=${safetyRatings}`,
          );
        }

        for (const part of candidate.content.parts) {
          if (part.inlineData?.data) {
            return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType ?? 'image/png' };
          }
        }

        throw new Error(
          `Gemini response contained no image data. finishReason=${finishReason}, parts=${candidate.content.parts.length}`,
        );
      }),
    );
  }
}

export function buildImagePrompt(prompt: string): string {
  return `${prompt.trim()}\n\n${PRODUCT_INTEGRITY_CONSTRAINTS}`;
}

function safeParseJson(text: string): Record<string, unknown> | null {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
