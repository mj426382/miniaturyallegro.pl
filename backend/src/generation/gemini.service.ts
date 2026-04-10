import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import axios from 'axios';

export interface GenerationStyle {
  id: string;
  name: string;
  prompt: string;
}

export const GENERATION_STYLES: GenerationStyle[] = [
  { id: 'white-bg', name: 'Białe tło', prompt: 'Profesjonalne zdjęcie produktowe na czystym białym tle, oświetlenie studyjne, ostry fokus, styl fotografii komercyjnej' },
  { id: 'gradient-bg', name: 'Gradient tło', prompt: 'Profesjonalne zdjęcie produktowe z eleganckim gradientowym tłem, miękkie oświetlenie, nowoczesny styl e-commerce' },
  { id: 'lifestyle-home', name: 'Styl życia - dom', prompt: 'Zdjęcie produktowe w stylu lifestyle w nowoczesnym wnętrzu domowym, naturalne światło, aspiracyjny klimat' },
  { id: 'in-action', name: 'Produkt w akcji', prompt: 'Pokaż produkt aktywnie używany przez osobę w realistycznym codziennym scenariuszu. Ręce trzymające produkt, naturalne otoczenie, dynamiczna kompozycja pokazująca funkcjonalność i przeznaczenie produktu. Fotorealistyczna fotografia lifestyle.' },
  { id: 'dark-luxury', name: 'Ciemny luksus', prompt: 'Luksusowe zdjęcie produktowe na ciemnym tle, dramatyczne oświetlenie, premium klimat, wysoki kontrast' },
  { id: 'multi-angle', name: 'Wiele perspektyw', prompt: 'Stwórz profesjonalny kolaż pokazujący produkt z 3-4 różnych kątów w przejrzystym układzie siatki: widok z przodu, z boku, z góry/detal i zbliżenie na kluczowe cechy. Białe lub jasnoszare tło, spójne oświetlenie studyjne we wszystkich ujęciach. Styl prezentacji produktu e-commerce.' },
];

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

/** Supported inline image MIME types accepted by the Gemini API. */
type GeminiImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

interface ImageGenerationConfig {
  responseModalities: Array<'IMAGE' | 'TEXT'>;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  // ─── OpenAI for text tasks (reliable, no 503) ────────────────────
  private readonly openaiApiKey: string;
  private readonly TEXT_MODEL = 'gpt-4o-mini';

  // ─── Gemini for image generation (only model that does image→image) ─
  private genAI: GoogleGenerativeAI;
  private readonly IMAGE_MODEL = 'gemini-2.5-flash-image';

  private readonly MAX_RETRIES = 4;
  private readonly BASE_DELAY_MS = 2000;

  constructor(private configService: ConfigService) {
    this.openaiApiKey = configService.get<string>('OPENAI_API_KEY');
    const geminiKey = configService.get<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(geminiKey);
  }

  // ─── OpenAI text helpers ──────────────────────────────────────────

  private async openaiChat(label: string, messages: Array<{ role: string; content: any }>): Promise<string> {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          { model: this.TEXT_MODEL, messages, max_tokens: 2000 },
          {
            headers: {
              'Authorization': `Bearer ${this.openaiApiKey}`,
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
        this.logger.warn(`[${label}] Attempt ${attempt + 1}/${this.MAX_RETRIES} failed (${status}). Retrying in ${Math.round(delay)}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error(`[${label}] All retries exhausted`);
  }

  private async textCompletion(label: string, systemPrompt: string, userPrompt: string): Promise<string> {
    return this.openaiChat(label, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }

  private async visionCompletion(label: string, systemPrompt: string, userText: string, imageBase64: string, mimeType: string): Promise<string> {
    return this.openaiChat(label, [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: userText },
        ],
      },
    ]);
  }

  // ─── Gemini image retry ───────────────────────────────────────────

  private async geminiRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
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
        this.logger.warn(`[${label}] Attempt ${attempt + 1}/${this.MAX_RETRIES} failed: ${message.substring(0, 200)}. Retrying in ${Math.round(delay)}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error(`[${label}] All retries exhausted`);
  }

  // ─── Public API: text tasks → OpenAI ──────────────────────────────

  async generateImageDescription(imageBase64: string, mimeType: string): Promise<string> {
    return this.visionCompletion(
      'generateImageDescription',
      'Jesteś ekspertem od opisu produktów e-commerce. Odpowiadasz po polsku.',
      'Opisz ten produkt szczegółowo na potrzeby generowania obrazów AI, które musi zachować produkt dokładnie w oryginalnej formie. Uwzględnij: typ produktu, dokładny kształt i proporcje (stosunek boków, proste/zakrzywione krawędzie, symetrię), wszystkie kolory i gradienty, tekstury powierzchni i materiały, loga/etykiety/napisy, charakterystyczne cechy (przyciski, porty, szwy itp.) oraz przeznaczenie. Bądź zwięzły, ale dokładny (3-4 zdania).',
      imageBase64,
      mimeType,
    );
  }

  async generatePromptForStyle(
    productDescription: string,
    style: GenerationStyle,
    basePrompt?: string,
  ): Promise<string> {
    const basePromptSection = basePrompt
      ? `Dodatkowe wskazówki użytkownika (zastosuj do WSZYSTKICH stylów): ${basePrompt}\n`
      : '';

    return this.textCompletion(
      'generatePromptForStyle',
      'Jesteś światowej klasy inżynierem promptów specjalizującym się w fotorealistycznych miniaturkach produktów e-commerce. Zwracasz TYLKO tekst promptu, bez komentarzy. Prompt piszesz po polsku.',
      `Opis produktu: ${productDescription}
${basePromptSection}Styl: ${style.name}
Bazowy prompt stylu: ${style.prompt}

Stwórz szczegółowy prompt do generowania obrazu, który łączy produkt z żądanym stylem.

=== BEZWZGLĘDNE ZASADY INTEGRALNOŚCI PRODUKTU (umieść WSZYSTKIE w wygenerowanym prompcie) ===
1. WIERNA REPRODUKCJA PRODUKTU — identyczna geometria, proporcje, sylwetka. Żadnego rozciągania, ściskania, wyginania.
2. ZACHOWAJ KAŻDY DETAL WIZUALNY — kolory, tekstury, loga, napisy, materiały.
3. ŻADNEJ TWÓRCZEJ REINTERPRETACJI — produkt to święty, nietykalny element.
4. ZMIENIAJ TYLKO OTOCZENIE — tło, scena, oświetlenie, cienie.
5. NATURALNE UMIEJSCOWIENIE z poprawnymi cieniami.
6. FOTOREALISTYCZNY REZULTAT.`,
    );
  }

  async generateCustomPrompt(
    productDescription: string,
    userPrompt: string,
  ): Promise<string> {
    return this.textCompletion(
      'generateCustomPrompt',
      'Jesteś światowej klasy inżynierem promptów specjalizującym się w fotorealistycznych miniaturkach produktów e-commerce. Zwracasz TYLKO tekst promptu, bez komentarzy. Prompt piszesz po polsku.',
      `Opis produktu: ${productDescription}
Życzenie użytkownika: ${userPrompt}

Stwórz szczegółowy prompt do generowania obrazu, który umieszcza produkt w scenie/stylu opisanym przez użytkownika.

=== BEZWZGLĘDNE ZASADY INTEGRALNOŚCI PRODUKTU (umieść WSZYSTKIE w wygenerowanym prompcie) ===
1. WIERNA REPRODUKCJA PRODUKTU — identyczna geometria, proporcje, sylwetka.
2. ZACHOWAJ KAŻDY DETAL WIZUALNY — kolory, tekstury, loga, napisy, materiały.
3. ŻADNEJ TWÓRCZEJ REINTERPRETACJI — produkt to nietykalny element.
4. ZMIENIAJ TYLKO OTOCZENIE — tło, scena, oświetlenie, cienie.
5. NATURALNE UMIEJSCOWIENIE z poprawnymi cieniami.
6. FOTOREALISTYCZNY REZULTAT.`,
    );
  }

  async generateReworkPrompt(
    productDescription: string,
    userPrompt: string,
  ): Promise<string> {
    return this.textCompletion(
      'generateReworkPrompt',
      'Jesteś światowej klasy inżynierem promptów specjalizującym się w fotorealistycznych miniaturkach produktów e-commerce. Zwracasz TYLKO tekst promptu, bez komentarzy. Prompt piszesz po polsku.',
      `Opis produktu: ${productDescription}
Żądana modyfikacja: ${userPrompt}

Użytkownik chce ZMODYFIKOWAĆ już wygenerowaną miniaturkę.
Stwórz szczegółowy prompt, który instruuje AI, aby zastosowało TYLKO żądane zmiany.

=== ZASADY ===
1. ZACZNIJ OD DOSTARCZONEGO OBRAZU — edycja, nie nowa generacja.
2. ZACHOWAJ PRODUKT IDENTYCZNIE — geometria, kolory, detale.
3. ZASADA MINIMALNEJ ZMIANY — modyfikuj TYLKO to, o co użytkownik poprosił.
4. FOTOREALISTYCZNY REZULTAT.`,
    );
  }

  async generateAllStylePrompts(
    productDescription: string,
    styles: GenerationStyle[],
    basePrompt?: string,
  ): Promise<Map<string, string>> {
    const basePromptSection = basePrompt
      ? `Dodatkowe wskazówki użytkownika (zastosuj do WSZYSTKICH stylów): ${basePrompt}\n`
      : '';

    const stylesListText = styles.map((s, i) => `${i + 1}. ID: "${s.id}" | Nazwa: "${s.name}" | Bazowy prompt: "${s.prompt}"`).join('\n');

    const responseText = await this.textCompletion(
      'generateAllStylePrompts',
      'Jesteś światowej klasy inżynierem promptów specjalizującym się w fotorealistycznych miniaturkach produktów e-commerce. Odpowiadasz DOKŁADNIE w żądanym formacie. Prompty piszesz po polsku.',
      `Opis produktu: ${productDescription}
${basePromptSection}
Wygeneruj prompt do generowania obrazu DLA KAŻDEGO z poniższych stylów:
${stylesListText}

=== ZASADY INTEGRALNOŚCI PRODUKTU (umieść w KAŻDYM prompcie) ===
1. WIERNA REPRODUKCJA PRODUKTU — identyczna geometria, proporcje, sylwetka.
2. ZACHOWAJ KAŻDY DETAL WIZUALNY — kolory, tekstury, loga, napisy.
3. ŻADNEJ TWÓRCZEJ REINTERPRETACJI — produkt to nietykalny element.
4. ZMIENIAJ TYLKO OTOCZENIE — tło, scena, oświetlenie, cienie.
5. NATURALNE UMIEJSCOWIENIE z poprawnymi cieniami.
6. FOTOREALISTYCZNY REZULTAT.

ODPOWIEDZ W FORMACIE (dokładnie, bez dodatkowego tekstu):
===ID_STYLU===
[prompt po polsku]
===KONIEC===

Przykład:
===white-bg===
Profesjonalne zdjęcie produktu...
===KONIEC===
===gradient-bg===
Eleganckie zdjęcie z gradientem...
===KONIEC===`,
    );

    const prompts = new Map<string, string>();

    for (const style of styles) {
      const regex = new RegExp(`===${style.id}===\\n?([\\s\\S]*?)===KONIEC===`);
      const match = responseText.match(regex);
      if (match) {
        prompts.set(style.id, match[1].trim());
      } else {
        this.logger.warn(`Could not parse prompt for style ${style.id} from batch, using fallback`);
        prompts.set(style.id, style.prompt);
      }
    }

    return prompts;
  }

  // ─── Public API: image generation → Gemini ────────────────────────

  async generateImage(
    imageBase64: string,
    imageMimeType: string,
    prompt: string,
    referenceImageBase64?: string,
    referenceImageMimeType?: string,
  ): Promise<GeneratedImage> {
    const model = this.genAI.getGenerativeModel({ model: this.IMAGE_MODEL });

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
      parts.push({ text: 'Drugi obraz powyżej to REFERENCJA wyłącznie dla stylu/tła/kompozycji. Użyj go jako wizualnej inspiracji dla otoczenia i oświetlenia — NIE kopiuj, nie przenoś ani nie łącz żadnych produktów ani obiektów z niego do wyniku. Produkt z PIERWSZEGO obrazu musi pozostać geometrycznie i wizualnie nienaruszony.' });
    }

    parts.push({ text: `${prompt}\n\n=== OBOWIĄZKOWE OGRANICZENIE INTEGRALNOŚCI PRODUKTU ===\nProdukt widoczny na PIERWSZYM zdjęciu jest ZABLOKOWANY. MUSISZ go odwzorować z:\n• Identyczną geometrią, sylwetką, proporcjami i stosunkiem boków — ŻADNEGO rozciągania, ściskania, wyginania.\n• Identycznymi kolorami, teksturami, logami, etykietami, napisami, wykończeniem powierzchni.\n• ŻADNEGO przeprojektowywania, upraszczania, stylizacji ani artystycznej reinterpretacji produktu.\n• Produkt to nietykalny element — traktuj go jak wycięty i wklejony na nową scenę.\n• Możesz JEDYNIE zmieniać: tło, otoczenie, oświetlenie sceny, cienie otoczenia.\n• Wynik musi być fotorealistyczny, w wysokiej rozdzielczości, odpowiedni jako profesjonalna miniaturka e-commerce.` });

    const generationConfig: ImageGenerationConfig = {
      responseModalities: ['IMAGE'],
    };

    return this.geminiRetry('generateImage', async () => {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: generationConfig as any,
      });

      const candidate = result.response.candidates?.[0];
      if (!candidate) {
        throw new Error('Gemini returned no candidates');
      }

      const finishReason = candidate.finishReason ?? 'UNKNOWN';
      const safetyRatings = candidate.safetyRatings
        ? JSON.stringify(candidate.safetyRatings)
        : 'none';

      if (!candidate.content?.parts?.length) {
        throw new Error(
          `Gemini candidate has no content/parts. finishReason=${finishReason}, safetyRatings=${safetyRatings}`,
        );
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          return {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType ?? 'image/png',
          };
        }
      }

      throw new Error(
        `Gemini response contained no image data. finishReason=${finishReason}, parts=${candidate.content.parts.length}`,
      );
    });
  }
}
