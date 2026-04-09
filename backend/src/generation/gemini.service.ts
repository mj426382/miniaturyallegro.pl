import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

export interface GenerationStyle {
  id: string;
  name: string;
  prompt: string;
}

export const GENERATION_STYLES: GenerationStyle[] = [
  { id: 'white-bg', name: 'Białe tło', prompt: 'Professional product photo on pure white background, studio lighting, sharp focus, commercial photography style' },
  { id: 'gradient-bg', name: 'Gradient tło', prompt: 'Professional product photo with elegant gradient background, soft lighting, modern e-commerce style' },
  { id: 'lifestyle-home', name: 'Styl życia - dom', prompt: 'Lifestyle product photo in a modern home setting, natural light, aspirational feel' },
  { id: 'in-action', name: 'Produkt w akcji', prompt: 'Show the product being actively used by a person in a realistic everyday scenario. Hands interacting with the product, natural environment, dynamic composition that demonstrates the product functionality and purpose. Photorealistic lifestyle photography.' },
  { id: 'dark-luxury', name: 'Ciemny luksus', prompt: 'Luxury product photo on dark background, dramatic lighting, premium feel, high contrast' },
  { id: 'multi-angle', name: 'Wiele perspektyw', prompt: 'Create a professional composite image showing the product from 3-4 different angles arranged in a clean grid or collage layout: front view, side view, top/detail view, and a close-up of key features. White or light grey background, consistent studio lighting across all angles. E-commerce product showcase style.' },
];

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

/** Supported inline image MIME types accepted by the Gemini API. */
type GeminiImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/**
 * Extended generation config that includes `responseModalities` which is
 * supported by Gemini image-generation models but not yet typed in the SDK.
 */
interface ImageGenerationConfig {
  responseModalities: Array<'IMAGE' | 'TEXT'>;
}

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(GeminiService.name);

  private readonly MAX_RETRIES = 4;
  private readonly BASE_DELAY_MS = 2000;

  constructor(private configService: ConfigService) {
    const apiKey = configService.get<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Retry a function with exponential backoff on transient errors (503, 429, etc.)
   */
  private async withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const message = error?.message ?? '';
        const isRetryable =
          message.includes('503') ||
          message.includes('429') ||
          message.includes('Service Unavailable') ||
          message.includes('high demand') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('overloaded');

        if (!isRetryable || attempt === this.MAX_RETRIES) {
          throw error;
        }

        const delay = this.BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
        this.logger.warn(
          `[${label}] Attempt ${attempt + 1}/${this.MAX_RETRIES} failed (retryable). Retrying in ${Math.round(delay)}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error(`[${label}] All retries exhausted`);
  }

  async generateImageDescription(imageBase64: string, mimeType: string): Promise<string> {
    return this.withRetry('generateImageDescription', async () => {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const imagePart: Part = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType as GeminiImageMimeType,
        },
      };

      const result = await model.generateContent([
        imagePart,
        'Describe this product in precise detail for use in AI image generation that must preserve the product exactly. Include: product type, exact shape and proportions (aspect ratio, straight/curved edges, symmetry), all colours and gradients, surface textures and materials, logos/labels/text, notable features (buttons, ports, stitching, etc.), and intended use. Be concise but thorough (3-4 sentences).',
      ]);

      return result.response.text();
    });
  }

  async generatePromptForStyle(
    productDescription: string,
    style: GenerationStyle,
    basePrompt?: string,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const basePromptSection = basePrompt
      ? `User base instruction (apply to ALL styles): ${basePrompt}\n`
      : '';

    return this.withRetry('generatePromptForStyle', async () => {
      const result = await model.generateContent([
        `You are a world-class prompt engineer specialising in photorealistic e-commerce product thumbnails.

Product description: ${productDescription}
${basePromptSection}Style: ${style.name}
Base style prompt: ${style.prompt}

Create a detailed image-generation prompt that combines the product with the requested style.

=== ABSOLUTE PRODUCT-INTEGRITY RULES (embed ALL of these in the output prompt) ===
1. PIXEL-PERFECT PRODUCT REPRODUCTION — the product must be an exact, undistorted copy of the source photo: identical geometry, proportions, aspect ratio, curvature, edges, corners, and silhouette. No stretching, squishing, warping, bending, skewing, or perspective changes.
2. PRESERVE EVERY VISUAL DETAIL — same colours, textures, surface finish, reflections, logos, labels, text, stitching, buttons, ports, patterns, and materials. Nothing added, nothing removed.
3. NO CREATIVE REINTERPRETATION — do NOT redesign, stylize, cartoonify, simplify, or artistically alter the product in any way. Treat it as a sacred, untouchable element.
4. CHANGE ONLY THE ENVIRONMENT — background, scene, lighting, shadows, and reflections on surrounding surfaces may change to match the style. The product itself is a locked layer.
5. NATURAL PLACEMENT — the product must sit naturally in the scene with physically correct shadows and reflections, but its shape must not adapt to the environment (no bending to fit a surface, no fisheye, no artificial tilt).
6. PHOTOREALISTIC OUTPUT — the final image must look like a real high-end product photograph, not a render or illustration.

Return ONLY the prompt text, no commentary.`,
      ]);

      return result.response.text();
    });
  }

  async generateCustomPrompt(
    productDescription: string,
    userPrompt: string,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    return this.withRetry('generateCustomPrompt', async () => {
      const result = await model.generateContent([
        `You are a world-class prompt engineer specialising in photorealistic e-commerce product thumbnails.

Product description: ${productDescription}
User creative request: ${userPrompt}

Create a detailed image-generation prompt that places the product in the scene/style the user described.

=== ABSOLUTE PRODUCT-INTEGRITY RULES (embed ALL of these in the output prompt) ===
1. PIXEL-PERFECT PRODUCT REPRODUCTION — the product must be an exact, undistorted copy of the source photo: identical geometry, proportions, aspect ratio, curvature, edges, corners, and silhouette. No stretching, squishing, warping, bending, skewing, or perspective changes.
2. PRESERVE EVERY VISUAL DETAIL — same colours, textures, surface finish, reflections, logos, labels, text, stitching, buttons, ports, patterns, and materials. Nothing added, nothing removed.
3. NO CREATIVE REINTERPRETATION — do NOT redesign, stylize, cartoonify, simplify, or artistically alter the product in any way.
4. CHANGE ONLY THE ENVIRONMENT — background, scene, props, lighting, shadows, and ambient reflections may change per the user's request. The product itself is a locked, untouchable element.
5. NATURAL PLACEMENT — the product must sit naturally with physically correct shadows, but its shape must NOT adapt or deform to fit the environment.
6. PHOTOREALISTIC OUTPUT — the final image must look like a real product photograph.

Return ONLY the prompt text, no commentary.`,
      ]);

      return result.response.text();
    });
  }

  async generateReworkPrompt(
    productDescription: string,
    userPrompt: string,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    return this.withRetry('generateReworkPrompt', async () => {
      const result = await model.generateContent([
        `You are a world-class prompt engineer specialising in photorealistic e-commerce product thumbnails.

Product description: ${productDescription}
User modification request: ${userPrompt}

The user wants to MODIFY an already-generated thumbnail. The FIRST image will be the existing thumbnail to refine.
Create a detailed prompt that instructs the AI to apply ONLY the requested changes.

=== ABSOLUTE PRODUCT-INTEGRITY RULES (embed ALL of these in the output prompt) ===
1. START FROM THE PROVIDED IMAGE — this is an edit/refinement, NOT a new generation. Use the existing thumbnail as the starting canvas.
2. PIXEL-PERFECT PRODUCT SHAPE — the product's geometry, proportions, aspect ratio, curvature, edges, corners, and silhouette must remain 100 % identical. No stretching, squishing, warping, bending, skewing, or perspective changes whatsoever.
3. PRESERVE EVERY VISUAL DETAIL — same colours, textures, surface finish, reflections, logos, labels, text, stitching, buttons, ports, patterns, and materials. Nothing added to or removed from the product.
4. NO CREATIVE REINTERPRETATION — do NOT redesign, stylize, cartoonify, simplify, or artistically alter the product.
5. MINIMAL CHANGE PRINCIPLE — modify ONLY what the user explicitly requested. Everything else (composition, product placement, product appearance) stays identical to the input.
6. PHOTOREALISTIC OUTPUT — the final image must look like a real product photograph.

Return ONLY the prompt text, no commentary.`,
      ]);

      return result.response.text();
    });
  }

  async generateImage(
    imageBase64: string,
    imageMimeType: string,
    prompt: string,
    referenceImageBase64?: string,
    referenceImageMimeType?: string,
  ): Promise<GeneratedImage> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
    });

    const imagePart: Part = {
      inlineData: {
        data: imageBase64,
        mimeType: imageMimeType as GeminiImageMimeType,
      },
    };

    const parts: Part[] = [imagePart];

    if (referenceImageBase64 && referenceImageMimeType) {
      parts.push({
        inlineData: {
          data: referenceImageBase64,
          mimeType: referenceImageMimeType as GeminiImageMimeType,
        },
      });
      parts.push({ text: 'The second image above is a REFERENCE for style/background/composition ONLY. Use it as visual inspiration for the environment and lighting — do NOT copy, morph, or blend any products or objects from it into the output. The product from the FIRST image must remain geometrically and visually untouched.' });
    }

    parts.push({ text: `${prompt}\n\n=== MANDATORY PRODUCT-INTEGRITY CONSTRAINT ===\nThe product visible in the FIRST photo is LOCKED. You MUST reproduce it with:\n• Identical geometry, silhouette, proportions, and aspect ratio — NO stretching, squishing, warping, bending, skewing, rounding of corners, or any spatial distortion.\n• Identical colours, textures, logos, labels, text, surface finish, reflections, stitching, buttons, ports, and patterns — pixel-level fidelity.\n• NO redesign, simplification, stylization, cartoon effects, or artistic reinterpretation of the product.\n• The product is an untouchable, sacred element — treat it as a cut-out pasted onto the new scene.\n• You may ONLY change: background, environment, scene lighting, ambient shadows, and reflections on surrounding surfaces.\n• Output must be photorealistic, high-resolution, suitable as a professional e-commerce thumbnail.` });

    const generationConfig: ImageGenerationConfig = {
      responseModalities: ['IMAGE'],
    };

    return this.withRetry('generateImage', async () => {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: generationConfig as any,
      });

      const candidate = result.response.candidates?.[0];
      if (!candidate) {
        throw new Error('Gemini returned no candidates');
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          return {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType ?? 'image/png',
          };
        }
      }

      throw new Error('Gemini response contained no image data');
    });
  }
}
