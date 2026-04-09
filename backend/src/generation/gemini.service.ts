import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

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

  /** Cheap model for text-only tasks (descriptions, prompt engineering) */
  private readonly TEXT_MODEL = 'gemini-2.5-flash';
  /** Image generation model */
  private readonly IMAGE_MODEL = 'gemini-2.5-flash-preview-04-17';

  private readonly MAX_RETRIES = 6;
  private readonly BASE_DELAY_MS = 3000;

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
      const model = this.genAI.getGenerativeModel({ model: this.TEXT_MODEL });

      const imagePart: Part = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType as GeminiImageMimeType,
        },
      };

      const result = await model.generateContent([
        imagePart,
        'Opisz ten produkt szczegółowo na potrzeby generowania obrazów AI, które musi zachować produkt dokładnie w oryginalnej formie. Uwzględnij: typ produktu, dokładny kształt i proporcje (stosunek boków, proste/zakrzywione krawędzie, symetrię), wszystkie kolory i gradienty, tekstury powierzchni i materiały, loga/etykiety/napisy, charakterystyczne cechy (przyciski, porty, szwy itp.) oraz przeznaczenie. Bądź zwięzły, ale dokładny (3-4 zdania). Odpowiedz po polsku.',
      ]);

      return result.response.text();
    });
  }

  async generatePromptForStyle(
    productDescription: string,
    style: GenerationStyle,
    basePrompt?: string,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.TEXT_MODEL });

    const basePromptSection = basePrompt
      ? `Dodatkowe wskazówki użytkownika (zastosuj do WSZYSTKICH stylów): ${basePrompt}\n`
      : '';

    return this.withRetry('generatePromptForStyle', async () => {
      const result = await model.generateContent([
        `Jesteś światowej klasy inżynierem promptów specjalizującym się w fotorealistycznych miniaturkach produktów e-commerce.

Opis produktu: ${productDescription}
${basePromptSection}Styl: ${style.name}
Bazowy prompt stylu: ${style.prompt}

Stwórz szczegółowy prompt do generowania obrazu, który łączy produkt z żądanym stylem.

=== BEZWZGLĘDNE ZASADY INTEGRALNOŚCI PRODUKTU (umieść WSZYSTKIE w wygenerowanym prompcie) ===
1. WIERNA REPRODUKCJA PRODUKTU — produkt musi być dokładną, niezniekształconą kopią zdjęcia źródłowego: identyczna geometria, proporcje, stosunek boków, krzywizny, krawędzie, narożniki i sylwetka. Żadnego rozciągania, ściskania, wyginania, skręcania, pochylania ani zmiany perspektywy.
2. ZACHOWAJ KAŻDY DETAL WIZUALNY — te same kolory, tekstury, wykończenie powierzchni, odbicia, loga, etykiety, napisy, szwy, przyciski, porty, wzory i materiały. Nic nie dodawaj, nic nie usuwaj.
3. ŻADNEJ TWÓRCZEJ REINTERPRETACJI — NIE przeprojektowuj, nie stylizuj, nie rób kreskówki, nie upraszczaj ani nie zmieniaj artystycznie produktu w żaden sposób. Traktuj go jako święty, nietykalny element.
4. ZMIENIAJ TYLKO OTOCZENIE — tło, scena, oświetlenie, cienie i odbicia na otaczających powierzchniach mogą się zmieniać zgodnie ze stylem. Sam produkt to zablokowana warstwa.
5. NATURALNE UMIEJSCOWIENIE — produkt musi naturalnie wyglądać w scenie z fizycznie poprawnymi cieniami i odbiciami, ale jego kształt NIE może się dostosowywać do otoczenia (bez wyginania do powierzchni, bez rybiego oka, bez sztucznego pochylenia).
6. FOTOREALISTYCZNY REZULTAT — końcowy obraz musi wyglądać jak prawdziwe, profesjonalne zdjęcie produktowe, nie render ani ilustracja.

Zwróć TYLKO tekst promptu, bez komentarzy. Prompt napisz po polsku.`,
      ]);

      return result.response.text();
    });
  }

  async generateCustomPrompt(
    productDescription: string,
    userPrompt: string,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.TEXT_MODEL });

    return this.withRetry('generateCustomPrompt', async () => {
      const result = await model.generateContent([
        `Jesteś światowej klasy inżynierem promptów specjalizującym się w fotorealistycznych miniaturkach produktów e-commerce.

Opis produktu: ${productDescription}
Życzenie użytkownika: ${userPrompt}

Stwórz szczegółowy prompt do generowania obrazu, który umieszcza produkt w scenie/stylu opisanym przez użytkownika.

=== BEZWZGLĘDNE ZASADY INTEGRALNOŚCI PRODUKTU (umieść WSZYSTKIE w wygenerowanym prompcie) ===
1. WIERNA REPRODUKCJA PRODUKTU — produkt musi być dokładną, niezniekształconą kopią zdjęcia źródłowego: identyczna geometria, proporcje, stosunek boków, krzywizny, krawędzie, narożniki i sylwetka. Żadnego rozciągania, ściskania, wyginania, skręcania, pochylania ani zmiany perspektywy.
2. ZACHOWAJ KAŻDY DETAL WIZUALNY — te same kolory, tekstury, wykończenie powierzchni, odbicia, loga, etykiety, napisy, szwy, przyciski, porty, wzory i materiały. Nic nie dodawaj, nic nie usuwaj.
3. ŻADNEJ TWÓRCZEJ REINTERPRETACJI — NIE przeprojektowuj, nie stylizuj, nie rób kreskówki, nie upraszczaj ani nie zmieniaj artystycznie produktu.
4. ZMIENIAJ TYLKO OTOCZENIE — tło, scena, rekwizyty, oświetlenie, cienie i odbicia otoczenia mogą się zmieniać zgodnie z życzeniem użytkownika. Sam produkt to zablokowany, nietykalny element.
5. NATURALNE UMIEJSCOWIENIE — produkt musi naturalnie wyglądać w scenie z fizycznie poprawnymi cieniami, ale jego kształt NIE może się dostosowywać ani deformować.
6. FOTOREALISTYCZNY REZULTAT — końcowy obraz musi wyglądać jak prawdziwe zdjęcie produktowe.

Zwróć TYLKO tekst promptu, bez komentarzy. Prompt napisz po polsku.`,
      ]);

      return result.response.text();
    });
  }

  async generateReworkPrompt(
    productDescription: string,
    userPrompt: string,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.TEXT_MODEL });

    return this.withRetry('generateReworkPrompt', async () => {
      const result = await model.generateContent([
        `Jesteś światowej klasy inżynierem promptów specjalizującym się w fotorealistycznych miniaturkach produktów e-commerce.

Opis produktu: ${productDescription}
Żądana modyfikacja: ${userPrompt}

Użytkownik chce ZMODYFIKOWAĆ już wygenerowaną miniaturkę. PIERWSZY obraz to istniejąca miniaturka do poprawy.
Stwórz szczegółowy prompt, który instruuje AI, aby zastosowało TYLKO żądane zmiany.

=== BEZWZGLĘDNE ZASADY INTEGRALNOŚCI PRODUKTU (umieść WSZYSTKIE w wygenerowanym prompcie) ===
1. ZACZNIJ OD DOSTARCZONEGO OBRAZU — to jest edycja/poprawka, NIE nowa generacja. Użyj istniejącej miniaturki jako płótna startowego.
2. IDEALNY KSZTAŁT PRODUKTU — geometria, proporcje, stosunek boków, krzywizny, krawędzie, narożniki i sylwetka produktu muszą pozostać w 100% identyczne. Żadnego rozciągania, ściskania, wyginania, skręcania, pochylania ani jakichkolwiek zmian perspektywy.
3. ZACHOWAJ KAŻDY DETAL WIZUALNY — te same kolory, tekstury, wykończenie powierzchni, odbicia, loga, etykiety, napisy, szwy, przyciski, porty, wzory i materiały. Nic nie dodawaj ani nie usuwaj z produktu.
4. ŻADNEJ TWÓRCZEJ REINTERPRETACJI — NIE przeprojektowuj, nie stylizuj, nie rób kreskówki, nie upraszczaj ani nie zmieniaj artystycznie produktu.
5. ZASADA MINIMALNEJ ZMIANY — modyfikuj TYLKO to, o co użytkownik wyraźnie poprosił. Wszystko inne (kompozycja, umiejscowienie produktu, wygląd produktu) pozostaje identyczne z wejściem.
6. FOTOREALISTYCZNY REZULTAT — końcowy obraz musi wyglądać jak prawdziwe zdjęcie produktowe.

Zwróć TYLKO tekst promptu, bez komentarzy. Prompt napisz po polsku.`,
      ]);

      return result.response.text();
    });
  }

  /**
   * Generate optimized prompts for ALL styles in a single API call.
   * Saves 5 API calls vs calling generatePromptForStyle 6 times.
   */
  async generateAllStylePrompts(
    productDescription: string,
    styles: GenerationStyle[],
    basePrompt?: string,
  ): Promise<Map<string, string>> {
    const model = this.genAI.getGenerativeModel({ model: this.TEXT_MODEL });

    const basePromptSection = basePrompt
      ? `Dodatkowe wskazówki użytkownika (zastosuj do WSZYSTKICH stylów): ${basePrompt}\n`
      : '';

    const stylesListText = styles.map((s, i) => `${i + 1}. ID: "${s.id}" | Nazwa: "${s.name}" | Bazowy prompt: "${s.prompt}"`).join('\n');

    return this.withRetry('generateAllStylePrompts', async () => {
      const result = await model.generateContent([
        `Jesteś światowej klasy inżynierem promptów specjalizującym się w fotorealistycznych miniaturkach produktów e-commerce.

Opis produktu: ${productDescription}
${basePromptSection}
Wygeneruj prompt do generowania obrazu DLA KAŻDEGO z poniższych stylów:
${stylesListText}

=== BEZWZGLĘDNE ZASADY INTEGRALNOŚCI PRODUKTU (umieść w KAŻDYM prompcie) ===
1. WIERNA REPRODUKCJA PRODUKTU — identyczna geometria, proporcje, sylwetka. Żadnego rozciągania, ściskania, wyginania.
2. ZACHOWAJ KAŻDY DETAL WIZUALNY — kolory, tekstury, loga, napisy, materiały.
3. ŻADNEJ TWÓRCZEJ REINTERPRETACJI — produkt to święty, nietykalny element.
4. ZMIENIAJ TYLKO OTOCZENIE — tło, scena, oświetlenie, cienie.
5. NATURALNE UMIEJSCOWIENIE z poprawnymi cieniami.
6. FOTOREALISTYCZNY REZULTAT.

ODPOWIEDZ W FORMACIE (dokładnie, bez dodatkowego tekstu):
===ID_STYLU===
[prompt po polsku]
===KONIEC===

Przyład:
===white-bg===
Profesjonalne zdjęcie produktu...
===KONIEC===
===gradient-bg===
Eleganckie zdjęcie z gradientem...
===KONIEC===`,
      ]);

      const responseText = result.response.text();
      const prompts = new Map<string, string>();

      for (const style of styles) {
        const regex = new RegExp(`===${style.id}===\\n?([\\s\\S]*?)===KONIEC===`);
        const match = responseText.match(regex);
        if (match) {
          prompts.set(style.id, match[1].trim());
        } else {
          // Fallback: generate individually
          this.logger.warn(`Could not parse prompt for style ${style.id} from batch, using fallback`);
          prompts.set(style.id, style.prompt);
        }
      }

      return prompts;
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
      model: this.IMAGE_MODEL,
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
      parts.push({ text: 'Drugi obraz powyżej to REFERENCJA wyłącznie dla stylu/tła/kompozycji. Użyj go jako wizualnej inspiracji dla otoczenia i oświetlenia — NIE kopiuj, nie przenoś ani nie łącz żadnych produktów ani obiektów z niego do wyniku. Produkt z PIERWSZEGO obrazu musi pozostać geometrycznie i wizualnie nienaruszony.' });
    }

    parts.push({ text: `${prompt}\n\n=== OBOWIĄZKOWE OGRANICZENIE INTEGRALNOŚCI PRODUKTU ===\nProdukt widoczny na PIERWSZYM zdjęciu jest ZABLOKOWANY. MUSISZ go odwzorować z:\n• Identyczną geometrią, sylwetką, proporcjami i stosunkiem boków — ŻADNEGO rozciągania, ściskania, wyginania, skręcania, pochylania, zaokrąglania narożników ani jakiejkolwiek deformacji przestrzennej.\n• Identycznymi kolorami, teksturami, logami, etykietami, napisami, wykończeniem powierzchni, odbiciami, szwami, przyciskami, portami i wzorami — wierność na poziomie pikseli.\n• ŻADNEGO przeprojektowywania, upraszczania, stylizacji, efektów kreskówkowych ani artystycznej reinterpretacji produktu.\n• Produkt to nietykalny, święty element — traktuj go jak wycięty i wklejony na nową scenę.\n• Możesz JEDYNIE zmieniać: tło, otoczenie, oświetlenie sceny, cienie otoczenia i odbicia na okolicznych powierzchniach.\n• Wynik musi być fotorealistyczny, w wysokiej rozdzielczości, odpowiedni jako profesjonalna miniaturka e-commerce.` });

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
