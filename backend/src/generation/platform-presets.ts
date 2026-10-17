/**
 * Sales platform presets (spec 08) – the single source of truth for platform-aware export and
 * offer copy. The app reads them from `GET /generation/platform-presets`; never copy the numbers.
 *
 * Every rule carries `official`: true = a published requirement of the platform (help page linked
 * in `source`), false = our recommendation where the platform publishes no hard rule. The UI shows
 * the latter as „zalecane”, never as a platform requirement. Verified 2026-10-17.
 */
import type { ExportFormat, ExportRatio } from './export.service';

export const PLATFORM_IDS = ['generic', 'olx', 'vinted', 'ebay', 'amazon'] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export interface PlatformRule {
  text: string;
  official: boolean;
}

export interface PlatformPreset {
  id: PlatformId;
  label: string;
  /** Allowed export ratios; the first one is the default. */
  ratios: ExportRatio[];
  /** Long edge in px: the export never goes below `minSize`; `targetSize` is the default. */
  minSize: number;
  minSizeOfficial: boolean;
  targetSize: number;
  formats: ExportFormat[];
  /** Fraction of the canvas the product's longer side should fill (white-margin trim), or null. */
  productFill: number | null;
  /** Promo badge on the image: forbidden = rejected by the API, discouraged = UI warning. */
  badge: 'allowed' | 'discouraged' | 'forbidden';
  titleMaxLength: number;
  titleMaxOfficial: boolean;
  /** Hint for the copywriting prompt (Polish, the model writes Polish). */
  promptHint: string;
  rules: PlatformRule[];
  source: string;
}

export const PLATFORM_PRESETS: Record<PlatformId, PlatformPreset> = {
  // No single rule for online shops – sensible defaults (square main photo, ≥ 1000 px for zoom).
  generic: {
    id: 'generic',
    label: 'Sklep internetowy / ogólne',
    ratios: ['1:1', '4:3', '3:4', '16:9'],
    minSize: 1000,
    minSizeOfficial: false,
    targetSize: 1600,
    formats: ['jpeg', 'png', 'webp'],
    productFill: null,
    badge: 'allowed',
    titleMaxLength: 75,
    titleMaxOfficial: false,
    promptHint:
      'Platforma: sklep internetowy lub ogólny marketplace. Opis z nagłówkami i listą cech, gotowy do wklejenia ' +
      'w edytor sklepu.',
    rules: [
      { text: 'Zdjęcie główne 1:1 na białym tle, min. 1000 px (zoom)', official: false },
      { text: 'Bez napisów i plakietek na zdjęciu głównym – na kolejnych zdjęciach można', official: false },
    ],
    source: 'Brak jednej reguły – rekomendacja AllGrafika',
  },
  // pomoc.olx.pl „Jak dodać ogłoszenie?”: up to 8 photos, JPG/JPEG/PNG ≤ 5 MB, 4:3 (1500 px wide);
  // the 70-char title is the listing form limit reported by seller guides, not a help-page rule.
  olx: {
    id: 'olx',
    label: 'OLX',
    ratios: ['4:3'],
    minSize: 1000,
    minSizeOfficial: false,
    targetSize: 1500,
    formats: ['jpeg', 'png'],
    productFill: null,
    badge: 'allowed',
    titleMaxLength: 70,
    titleMaxOfficial: false,
    promptHint:
      'Platforma: OLX – ogłoszenie lokalne. Konkretnie: co to jest, stan, co jest w zestawie, wymiary. ' +
      'OLX przyjmuje czysty tekst, więc pisz krótkie akapity i listy, które dobrze wyglądają po skopiowaniu jako tekst.',
    rules: [
      { text: 'Proporcje 4:3 (np. 1500×1125 px) – zdjęcia pionowe OLX przycina', official: true },
      { text: 'JPG lub PNG, do 5 MB, maks. 8 zdjęć', official: true },
      { text: 'Bez danych kontaktowych (np. numeru telefonu) na zdjęciu', official: true },
      { text: 'Tytuł do 70 znaków', official: false },
    ],
    source: 'https://pomoc.olx.pl/hc/pl/articles/211658765',
  },
  // vinted.co.uk/help/48: whole item on the first photo, no collages, own photos without watermarks.
  // Vinted publishes no size/ratio or title-length rule – portrait 3:4 matches its feed tiles.
  vinted: {
    id: 'vinted',
    label: 'Vinted',
    ratios: ['3:4', '1:1'],
    minSize: 800,
    minSizeOfficial: false,
    targetSize: 1600,
    formats: ['jpeg', 'png'],
    productFill: null,
    badge: 'discouraged',
    titleMaxLength: 50,
    titleMaxOfficial: false,
    promptHint:
      'Platforma: Vinted – sprzedaż między osobami, głównie moda i rzeczy używane. Ton naturalny i życzliwy, ' +
      'bez marketingowego zadęcia. Podaj stan, rozmiar, materiał i markę tylko jeśli wynikają z notatek. ' +
      'Vinted przyjmuje czysty tekst – krótkie akapity i listy.',
    rules: [
      { text: 'Pierwsze zdjęcie pokazuje cały przedmiot, bez kolaży', official: true },
      { text: 'Własne zdjęcia, bez znaków wodnych', official: true },
      { text: 'Zdjęcia pionowe 3:4 lub kwadratowe, min. 800 px', official: false },
      { text: 'Bez napisów i plakietek na zdjęciach', official: false },
      { text: 'Tytuł do 50 znaków (dłuższe są ucinane na liście)', official: false },
    ],
    source: 'https://www.vinted.co.uk/help/48',
  },
  // eBay Picture policy: ≥ 500 px on the longest side; no added borders, text, artwork or watermarks.
  // 1600 px is eBay's long-standing zoom recommendation; the 80-char title is the listing limit.
  ebay: {
    id: 'ebay',
    label: 'eBay',
    ratios: ['1:1', '4:3'],
    minSize: 500,
    minSizeOfficial: true,
    targetSize: 1600,
    formats: ['jpeg', 'png'],
    productFill: null,
    badge: 'forbidden',
    titleMaxLength: 80,
    titleMaxOfficial: true,
    promptHint:
      'Platforma: eBay. Tytuł z najważniejszymi słowami, których szukają kupujący (marka, model, typ, cecha), ' +
      'bez słów typu „super”, „okazja” i bez wykrzykników. Opis może zawierać prosty HTML.',
    rules: [
      { text: 'Min. 500 px na dłuższym boku', official: true },
      { text: 'Bez dodanych ramek, tekstu, grafik i znaków wodnych', official: true },
      { text: '1600 px na dłuższym boku dla powiększenia (zoom)', official: false },
      { text: 'Tytuł do 80 znaków', official: true },
    ],
    source: 'https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370',
  },
  // Seller Central „Product image requirements” (G1881): main image on pure white RGB 255,255,255,
  // product ≥ 85 % of the frame, ≥ 1000 px for zoom, JPEG preferred, no text/logos/badges.
  // Titles: max 75 characters since 2026-07-27 (Seller Central announcement 2026-06-10).
  amazon: {
    id: 'amazon',
    label: 'Amazon',
    ratios: ['1:1'],
    minSize: 1000,
    minSizeOfficial: true,
    targetSize: 2000,
    formats: ['jpeg', 'png'],
    productFill: 0.85,
    badge: 'forbidden',
    titleMaxLength: 75,
    titleMaxOfficial: true,
    promptHint:
      'Platforma: Amazon. Tytuł: marka (jeśli znana z notatek) + typ produktu + kluczowa cecha (materiał, rozmiar, ' +
      'kolor, ilość), bez słów promocyjnych, bez znaków specjalnych i bez WIELKICH LITER. Opis zaczyna się od listy ' +
      '5 najważniejszych cech (każda zaczyna się od korzyści).',
    rules: [
      { text: 'Zdjęcie główne: czysto białe tło (RGB 255, 255, 255)', official: true },
      { text: 'Produkt zajmuje min. 85 % kadru', official: true },
      { text: 'Min. 1000 px na dłuższym boku (zoom); JPEG preferowany', official: true },
      { text: 'Bez tekstu, logo, plakietek i znaków wodnych na zdjęciu głównym', official: true },
      { text: 'Kwadrat 1:1, 2000 px', official: false },
      { text: 'Tytuł do 75 znaków (od 27.07.2026)', official: true },
    ],
    source: 'https://sellercentral.amazon.com/help/hub/reference/external/G1881',
  },
};

export const DEFAULT_PLATFORM: PlatformId = 'generic';
/** The longest title any platform accepts – the DTO limit; the per-platform limit is checked in the service. */
export const MAX_PLATFORM_TITLE_LENGTH = Math.max(...PLATFORM_IDS.map((id) => PLATFORM_PRESETS[id].titleMaxLength));

export function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === 'string' && (PLATFORM_IDS as readonly string[]).includes(value);
}

export function getPlatformPreset(id: string | null | undefined): PlatformPreset {
  return isPlatformId(id) ? PLATFORM_PRESETS[id] : PLATFORM_PRESETS[DEFAULT_PLATFORM];
}

/** Public shape for the app (the prompt hint stays on the server). */
export function listPlatformPresets() {
  return PLATFORM_IDS.map((id) => {
    const p = PLATFORM_PRESETS[id];
    return {
      id: p.id,
      label: p.label,
      ratios: p.ratios,
      defaultRatio: p.ratios[0],
      minSize: p.minSize,
      minSizeOfficial: p.minSizeOfficial,
      targetSize: p.targetSize,
      formats: p.formats,
      defaultFormat: p.formats[0],
      productFill: p.productFill,
      badge: p.badge,
      titleMaxLength: p.titleMaxLength,
      titleMaxOfficial: p.titleMaxOfficial,
      rules: p.rules,
      source: p.source,
    };
  });
}
