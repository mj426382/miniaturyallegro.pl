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
  { id: 'minimal', name: 'Minimalistyczny', prompt: 'Minimalist product photo, clean lines, lots of white space, Scandinavian aesthetic' },
  { id: 'dark-luxury', name: 'Ciemny luksus', prompt: 'Luxury product photo on dark background, dramatic lighting, premium feel, high contrast' },
  { id: 'natural', name: 'Naturalny', prompt: 'Natural product photo with wooden surfaces and plant elements, warm organic feel' },
  { id: 'tech', name: 'Technologiczny', prompt: 'High-tech product photo with dark background and blue LED accents, futuristic look' },
  { id: 'pastel', name: 'Pastelowy', prompt: 'Soft pastel background product photo, playful and friendly mood, Instagram style' },
  { id: 'outdoor', name: 'Plenerowy', prompt: 'Product photo in outdoor natural setting with bokeh background, lifestyle feel' },
  { id: 'flat-lay', name: 'Płaskie ułożenie', prompt: 'Flat lay product photo from above, styled with complementary props on clean surface' },
  { id: 'close-up', name: 'Zbliżenie', prompt: 'Close-up product detail shot emphasizing texture and quality, macro photography style' },
  { id: 'allegro-style', name: 'Styl Allegro', prompt: 'Clean product photo optimized for Allegro marketplace, white background, all product details visible, high resolution' },
];

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(GeminiService.name);

  constructor(private configService: ConfigService) {
    const apiKey = configService.get<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateImageDescription(imageBase64: string, mimeType: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imagePart: Part = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType as any,
      },
    };

    const result = await model.generateContent([
      imagePart,
      'Describe this product in detail for use in generating marketing thumbnail images. Focus on the product type, key visual features, colors, and intended use. Keep the description concise (2-3 sentences).',
    ]);

    return result.response.text();
  }

  async generatePromptForStyle(
    productDescription: string,
    style: GenerationStyle,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      `You are an expert at creating prompts for AI image generation for e-commerce product thumbnails.
      
Product description: ${productDescription}
Style: ${style.name}
Base style prompt: ${style.prompt}

Create a detailed image generation prompt combining the product details with the style. The prompt should be suitable for creating a professional Allegro thumbnail. Return only the prompt, no explanations.`,
    ]);

    return result.response.text();
  }
}
