/**
 * Catalogue of automatic generation styles (spec 05).
 *
 * `prompt` is the English base prompt handed to the prompt-engineering model and
 * (as a fallback) directly to the image model. Image models are trained mostly on
 * English captions, so prompts are kept in English even though the UI is Polish.
 * `name`/`description` are shown to users. Every prompt is later wrapped with
 * PRODUCT_INTEGRITY_CONSTRAINTS (gemini.service.ts), which also forbids text and logos.
 */
export type StyleCategory = 'universal' | 'seasonal' | 'industry';

/** Inclusive date window `MM-DD`–`MM-DD`; `from > to` means the window crosses New Year. */
export interface SeasonWindow {
  from: string;
  to: string;
}

export interface GenerationStyle {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: StyleCategory;
  /** Part of the default "starter" batch (cheapest way to see the most diverse results). */
  starter: boolean;
  /** Seasonal styles only: when they are promoted in the UI ("Teraz"). Always available. */
  season?: SeasonWindow;
}

/** Seasonal and industry scenes must never invent copy – Allegro and model quality both demand it. */
const NO_COPY = ' Do not add any text, letters, numbers, logos, price tags or watermarks to the scene.';

export const GENERATION_STYLES: GenerationStyle[] = [
  // ─── Universal ─────────────────────────────────────────────────────
  {
    id: 'white-bg',
    name: 'Białe tło',
    description: 'Czyste białe tło – zgodne z wymaganiami zdjęcia głównego Allegro.',
    category: 'universal',
    starter: true,
    prompt:
      'Professional e-commerce packshot on a seamless pure white (#FFFFFF) background. Soft, even studio lighting, ' +
      'a subtle natural contact shadow under the product, product centred and filling about 80% of the square frame. ' +
      'No props, no additional objects, no gradients – the background must stay pure white to the edges, ' +
      'exactly like a marketplace main listing photo.',
  },
  {
    id: 'lifestyle-home',
    name: 'Lifestyle – wnętrze',
    description: 'Produkt w nowoczesnym, jasnym wnętrzu domowym.',
    category: 'universal',
    starter: true,
    prompt:
      'Lifestyle product photograph in a bright, modern home interior that matches the product category. ' +
      'Natural window light, shallow depth of field with a softly blurred background, aspirational but realistic ' +
      'styling with at most one or two tasteful props that never cover the product.',
  },
  {
    id: 'dark-luxury',
    name: 'Ciemny luksus',
    description: 'Ciemne tło, dramatyczne światło, premium klimat.',
    category: 'universal',
    starter: true,
    prompt:
      'Luxury product photograph on a dark charcoal or black background with dramatic, directional rim lighting, ' +
      'high contrast, subtle reflections on a glossy dark surface, premium editorial mood.',
  },
  {
    id: 'gradient-bg',
    name: 'Gradient',
    description: 'Elegancki gradient dopasowany do kolorystyki produktu.',
    category: 'universal',
    starter: false,
    prompt:
      'Clean studio product photograph on a smooth, elegant two-tone gradient background whose colours complement ' +
      'the product palette, soft diffused lighting, gentle shadow, modern e-commerce look.',
  },
  {
    id: 'in-action',
    name: 'Produkt w użyciu',
    description: 'Realistyczna scena pokazująca zastosowanie produktu.',
    category: 'universal',
    starter: false,
    prompt:
      'Photorealistic lifestyle scene showing the product being used in a realistic everyday situation that fits its ' +
      'purpose. If a person is shown, show only natural-looking hands interacting with the product; anatomy must be ' +
      'correct. Natural environment, dynamic but clean composition that keeps the product as the clear hero.',
  },
  {
    id: 'multi-angle',
    name: 'Wiele ujęć',
    description: 'Kolaż 3–4 ujęć produktu z różnych stron.',
    category: 'universal',
    starter: false,
    prompt:
      'Professional e-commerce collage presenting the same product from 3-4 angles in a tidy grid layout: front view, ' +
      'side view, top or detail view and a close-up of a key feature. White or light-grey background, consistent studio ' +
      'lighting in every tile, thin even spacing between tiles. Every tile must show exactly this product – no variations.',
  },

  // ─── Seasonal ──────────────────────────────────────────────────────
  {
    id: 'christmas',
    name: 'Boże Narodzenie',
    description: 'Świąteczny klimat: ciepłe światełka, gałązki świerku, delikatne ozdoby.',
    category: 'seasonal',
    starter: false,
    season: { from: '11-10', to: '12-24' },
    prompt:
      'Festive Christmas product photograph: the product on a warm wooden or soft linen surface, framed by fresh pine ' +
      'branches, a few tasteful red and gold baubles and warm fairy-light bokeh in the background. Cosy golden-hour ' +
      'lighting, elegant and uncluttered, the product stays the clear hero and is never covered by decorations.' +
      NO_COPY,
  },
  {
    id: 'black-friday',
    name: 'Black Friday',
    description: 'Mocny, wyprzedażowy klimat: czerń, złoto i neonowe akcenty.',
    category: 'seasonal',
    starter: false,
    season: { from: '11-01', to: '12-02' },
    prompt:
      'High-impact sale-season product photograph: matte black background with bold geometric shapes, dramatic ' +
      'spotlight from above and vivid gold or neon accent light streaks, glossy black reflective floor, energetic ' +
      'premium shopping-event mood, product sharply lit in the centre.' +
      NO_COPY,
  },
  {
    id: 'valentines',
    name: 'Walentynki',
    description: 'Romantycznie: róż, czerwień, płatki róż i miękkie światło.',
    category: 'seasonal',
    starter: false,
    season: { from: '01-20', to: '02-14' },
    prompt:
      "Romantic Valentine's Day product photograph: soft blush-pink and deep red palette, a few scattered rose petals " +
      'and subtle heart-shaped bokeh lights in the background, soft diffused lighting, gentle elegant mood, product ' +
      'centred and unobstructed.' +
      NO_COPY,
  },
  {
    id: 'easter',
    name: 'Wielkanoc',
    description: 'Wiosenne pastele, świeże kwiaty i naturalne światło.',
    category: 'seasonal',
    starter: false,
    season: { from: '03-01', to: '04-25' },
    prompt:
      'Fresh Easter spring product photograph: pastel palette, light natural wood or white surface, fresh tulips or ' +
      'daffodils and a few delicately painted eggs as subtle props, bright soft morning daylight, airy and joyful ' +
      'mood, the product remains the main subject.' +
      NO_COPY,
  },
  {
    id: 'summer',
    name: 'Lato',
    description: 'Słońce, plener i wakacyjny klimat.',
    category: 'seasonal',
    starter: false,
    season: { from: '06-01', to: '08-31' },
    prompt:
      'Bright summer product photograph outdoors: warm sunlight with crisp natural shadows, a sunny terrace, garden ' +
      'or beach setting that suits the product, vivid but natural colours, relaxed holiday mood, product in sharp ' +
      'focus and fully visible.' +
      NO_COPY,
  },

  // ─── Industry ──────────────────────────────────────────────────────
  {
    id: 'fashion',
    name: 'Moda i odzież',
    description: 'Flat lay na teksturowanym tle, jak w katalogu modowym.',
    category: 'industry',
    starter: false,
    prompt:
      'Fashion catalogue product photograph: the item neatly arranged as a flat lay on a neutral textured surface ' +
      '(linen, concrete or light wood), soft even daylight, a minimal accessory at most, crisp fabric texture and ' +
      'true-to-life colours, editorial yet clean. No person and no mannequin.' +
      NO_COPY,
  },
  {
    id: 'electronics',
    name: 'Elektronika',
    description: 'Nowoczesne studio tech: chłodne światło, refleksy, minimalizm.',
    category: 'industry',
    starter: false,
    prompt:
      'Sleek technology product photograph: dark graphite to cool grey gradient studio background, cool blue rim ' +
      'light outlining the product edges, subtle reflection on a smooth glossy surface, minimal and precise, premium ' +
      'tech launch aesthetic. Screens, if any, stay exactly as in the original.' +
      NO_COPY,
  },
  {
    id: 'beauty',
    name: 'Kosmetyki i uroda',
    description: 'Marmur, krople wody i botaniczne akcenty.',
    category: 'industry',
    starter: false,
    prompt:
      'Beauty and skincare product photograph: white or light marble surface, soft natural window light, a few fresh ' +
      'water droplets and a subtle botanical accent (eucalyptus leaf or flower petal), clean spa-like atmosphere, ' +
      'gentle shadows, luxurious but natural.' +
      NO_COPY,
  },
  {
    id: 'home-garden',
    name: 'Dom i ogród',
    description: 'Przytulne wnętrze albo zielony ogród – zależnie od produktu.',
    category: 'industry',
    starter: false,
    prompt:
      'Home and garden product photograph: the product placed in its natural setting – a cosy, well-kept home ' +
      'interior or a lush green garden or terrace, whichever fits the product – soft natural light, warm inviting ' +
      'atmosphere, realistic scale relative to the surroundings.' +
      NO_COPY,
  },
  {
    id: 'kids',
    name: 'Dziecięce i zabawki',
    description: 'Radosny, jasny pokój dziecięcy w pastelach.',
    category: 'industry',
    starter: false,
    prompt:
      "Cheerful children's product photograph: bright pastel playroom setting with soft rounded shapes and a few " +
      'simple wooden toys as background props, soft even light, friendly and safe atmosphere, product clearly in focus. ' +
      'No children shown.' +
      NO_COPY,
  },
  {
    id: 'sport',
    name: 'Sport i fitness',
    description: 'Dynamiczna scena sportowa: siłownia albo plener.',
    category: 'industry',
    starter: false,
    prompt:
      'Dynamic sports and fitness product photograph: modern gym floor or outdoor running track setting that fits the ' +
      'product, energetic contrasty lighting with a subtle light flare, motivating active mood, product sharp and ' +
      'prominent. No people.' +
      NO_COPY,
  },
  {
    id: 'automotive',
    name: 'Motoryzacja',
    description: 'Czysty warsztat lub garaż, metaliczne akcenty.',
    category: 'industry',
    starter: false,
    prompt:
      'Automotive product photograph: clean modern garage or workshop setting with brushed metal and dark rubber ' +
      'textures, cool technical lighting with crisp highlights on the product, professional and reliable mood, ' +
      'product shown at realistic scale.' +
      NO_COPY,
  },
  {
    id: 'food',
    name: 'Żywność i napoje',
    description: 'Naturalny stół, świeże składniki pasujące do produktu.',
    category: 'industry',
    starter: false,
    prompt:
      'Appetising food and beverage product photograph: rustic wooden or stone table, a few fresh ingredients that ' +
      'match the product, soft natural side light, warm inviting tones, shallow depth of field, packaging shown ' +
      'exactly as in the original.' +
      NO_COPY,
  },
];

export const STYLE_IDS = GENERATION_STYLES.map((s) => s.id);

export function getStyle(id: string): GenerationStyle | undefined {
  return GENERATION_STYLES.find((s) => s.id === id);
}

/** Resolves the default batch from env (DEFAULT_STYLE_IDS) or the `starter` flag. */
export function getDefaultStyleIds(envValue?: string): string[] {
  if (envValue) {
    const ids = envValue
      .split(',')
      .map((s) => s.trim())
      .filter((id) => STYLE_IDS.includes(id));
    if (ids.length) return ids;
  }
  return GENERATION_STYLES.filter((s) => s.starter).map((s) => s.id);
}

/** True when `date` (local calendar day) falls inside the style's season window. */
export function isInSeason(style: Pick<GenerationStyle, 'season'>, date: Date = new Date()): boolean {
  if (!style.season) return false;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const today = `${month}-${day}`;
  const { from, to } = style.season;
  return from <= to ? today >= from && today <= to : today >= from || today <= to;
}
