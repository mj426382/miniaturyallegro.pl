import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import axios from 'axios';
import { GenerationStyle } from './styles';
import { Semaphore } from '../common/semaphore';

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

export const REFERENCE_IMAGE_INSTRUCTION =
  'The SECOND image is a STYLE REFERENCE only (background, mood, lighting, composition). Use it as visual ' +
  'inspiration for the environment. Do NOT copy, transfer or merge any product or object from it into the result. ' +
  'The product from the FIRST image must remain geometrically and visually untouched.';

const PROMPT_ENGINEER_SYSTEM =
  'You are a world-class prompt engineer specialised in photorealistic e-commerce product imagery for the Polish ' +
  'marketplace Allegro. You write prompts in ENGLISH for an image-to-image model that receives the original product ' +
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
}

const OFFER_COPY_SYSTEM_PROMPT =
  'Jesteś copywriterem e-commerce specjalizującym się w ofertach na Allegro. Piszesz po polsku, poprawnie, konkretnie, ' +
  'bez lania wody i bez przesady. Odpowiadasz WYŁĄCZNIE obiektem JSON: {"title": string, "body": string, "keywords": string[]}.\n\n' +
  'TYTUŁ (title): maksymalnie 75 znaków (limit Allegro). Zaczyna się od typu/nazwy produktu, potem najważniejsze cechy ' +
  '(marka, model, rozmiar/pojemność, kolor, przeznaczenie). Bez wykrzykników, bez CAPS LOCKA, bez emoji, bez słów ' +
  '"promocja", "hit", "okazja", "najtaniej", "super", "mega".\n\n' +
  'OPIS (body): HTML złożony WYŁĄCZNIE z tagów <h2>, <p>, <ul>, <ol>, <li>, <b> – innych tagów i atrybutów Allegro nie ' +
  'dopuszcza. Bez linków, adresów www, e-maili, numerów telefonu, odwołań do innych sklepów i konkurencji, bez obietnic ' +
  'bez pokrycia ("najlepszy na rynku", "100% skuteczności"). Struktura: krótki akapit otwierający z realną korzyścią dla ' +
  'kupującego; <h2>Najważniejsze cechy</h2> z listą <ul>; <h2>Specyfikacja</h2> z listą parametrów – TYLKO dane podane przez ' +
  'sprzedawcę lub jednoznacznie widoczne na zdjęciu; <h2>Zastosowanie</h2> (dla kogo, do czego); <h2>Zawartość zestawu</h2> ' +
  'tylko jeśli wiadomo, co jest w zestawie. Celuj w 1200–2500 znaków, ale przy skąpych informacjach pisz krócej zamiast ' +
  'dopowiadać. Wpleć naturalnie frazy, którymi kupujący szukają ' +
  'takiego produktu na Allegro (nazwa produktu + cecha, potoczne synonimy), bez upychania słów kluczowych.\n\n' +
  'NIGDY nie wymyślaj parametrów (wymiarów, materiału, pojemności, mocy, gwarancji, certyfikatów), których nie podał ' +
  'sprzedawca i których nie widać na zdjęciu – jeśli czegoś brakuje, po prostu to pomiń.\n\n' +
  'FRAZY (keywords): 8–15 fraz po polsku, małymi literami, od najważniejszej, takich jak wpisują kupujący w wyszukiwarkę Allegro.';

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

  constructor(private configService: ConfigService) {
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
        const message = error?.response?.data?.error?.message || error?.message || '';
        const isQuotaError = status === 429 && String(message).toLowerCase().includes('quota');
        const isRetryable = (status === 429 && !isQuotaError) || status === 500 || status === 502 || status === 503;

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
   * Allegro offer copy in Polish: title (≤ 75 chars), description limited to the HTML tags
   * Allegro accepts, and search phrases. With `current` + `instruction` it rewrites an
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

    const raw = await this.textCompletion('generateOfferCopy', OFFER_COPY_SYSTEM_PROMPT, `${facts}\n\n${task}`, true);
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

  /** Prompt for a free-form scene described by the user (Polish → English). */
  async generateCustomPrompt(productDescription: string, userPrompt: string): Promise<string> {
    return this.textCompletion(
      'generateCustomPrompt',
      PROMPT_ENGINEER_SYSTEM,
      `Product description:\n${productDescription}

The user (writing in Polish) wants the product placed in this scene/style: "${userPrompt}"

Write ONE image-generation prompt in English that realises the user's wish while keeping the product exactly as ` +
        `described. Translate the user's intent faithfully; if the wish asks to change the product itself (colour, ` +
        `shape, text), ignore that part and only change the scene. Mention a square composition with the product ` +
        `centred and large in frame. End with "photorealistic, sharp focus, no text, no watermark, no extra objects". ` +
        `Return only the prompt text.`,
    );
  }

  /** Prompt for editing an already generated graphic with minimal changes. */
  async generateReworkPrompt(productDescription: string, userPrompt: string): Promise<string> {
    return this.textCompletion(
      'generateReworkPrompt',
      PROMPT_ENGINEER_SYSTEM,
      `Product description:\n${productDescription}

The FIRST image the model will receive is an ALREADY GENERATED graphic of this product; the SECOND image is the ` +
        `original product photo (reference for product identity). The user (writing in Polish) requests this change: ` +
        `"${userPrompt}"

Write ONE image-EDITING prompt in English that instructs the model to start from the first image and apply ONLY ` +
        `the requested change, keeping everything else (product, framing, lighting) identical. Be explicit that this is ` +
        `an edit, not a new generation. Return only the prompt text.`,
    );
  }

  // ─── Public API: image generation → Gemini ────────────────────────

  async generateImage(
    imageBase64: string,
    imageMimeType: string,
    prompt: string,
    referenceImageBase64?: string,
    referenceImageMimeType?: string,
  ): Promise<GeneratedImage> {
    // The SDK has no default timeout – a hung request would block a generation slot for ever.
    const model = this.genAI.getGenerativeModel({ model: this.IMAGE_MODEL }, { timeout: 180_000 });

    const parts: Part[] = [{ inlineData: { data: imageBase64, mimeType: imageMimeType as GeminiImageMimeType } }];

    if (referenceImageBase64 && referenceImageMimeType) {
      parts.push({
        inlineData: { data: referenceImageBase64, mimeType: referenceImageMimeType as GeminiImageMimeType },
      });
      parts.push({ text: REFERENCE_IMAGE_INSTRUCTION });
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
