/**
 * Spec 25 (AC-TOOL-003): platform photo requirements – ONLY values published on official help / documentation pages,
 * each with the URL it comes from. Where a platform publishes no value we say "brak oficjalnej wartości" and do not
 * judge it. Every source was opened and re-read on CHECKED_AT; re-check all of them when bumping the date.
 */
import { FORMAT_LABEL, MB, type ImageAnalysis, type ImageFormat } from './analyze'

export const CHECKED_AT = '2026-10-19'

export type Status = 'pass' | 'warn' | 'fail' | 'info'

export interface Source {
  id: string
  label: string
  url: string
}

export type Rule =
  | { kind: 'formats'; accepted: ImageFormat[]; severity: 'fail' | 'warn' }
  | { kind: 'minLongSide'; px: number; severity: 'fail' | 'warn' }
  | { kind: 'minShortSide'; px: number; severity: 'fail' | 'warn'; effectiveFrom?: string }
  | { kind: 'minWidth'; px: number; severity: 'fail' | 'warn' }
  | { kind: 'recommendedLongSide'; px: number }
  | { kind: 'recommendedShortSide'; px: number }
  | { kind: 'suggestedLongSide'; px: number }
  | { kind: 'maxSide'; px: number }
  | { kind: 'maxMegapixels'; mp: number }
  | { kind: 'maxBytes'; bytes: number; strictlyLess?: boolean }
  | { kind: 'ratios'; ratios: Array<[number, number]>; reason: string }
  | { kind: 'whiteBackground' }
  | { kind: 'noTransparency' }

export interface Requirement {
  /** What the official page says, in Polish (shown in the requirement table). */
  label: string
  value: string
  source: string
  rule: Rule
}

export interface Platform {
  id: 'olx' | 'vinted' | 'ebay' | 'amazon' | 'shopify' | 'woocommerce' | 'shoper' | 'prestashop' | 'google'
  name: string
  /** What the requirements apply to (e.g. the main image, documented theme defaults). */
  scope: string
  /** Our landing page about the platform. */
  landing: string
  sources: Source[]
  checkedAt: string
  requirements: Requirement[]
  /** Official rules the tool cannot check from the file (content, number of photos…). */
  notes: Array<{ text: string; source: string }>
  /** Points the platform does not publish – shown as "brak oficjalnej wartości". */
  undocumented: string[]
}

export const NO_OFFICIAL_VALUE = 'brak oficjalnej wartości'

const SHOP = '/zdjecia-produktowe-do-sklepu-internetowego'
const fmt = (list: ImageFormat[]) => list.map((f) => FORMAT_LABEL[f]).join(', ')

const EBAY_FORMATS: ImageFormat[] = ['jpeg', 'png', 'gif', 'tiff', 'bmp', 'webp', 'heic', 'avif']
const AMAZON_FORMATS: ImageFormat[] = ['jpeg', 'tiff', 'png']
const SHOPIFY_FORMATS: ImageFormat[] = ['png', 'jpeg', 'tiff', 'bmp', 'gif', 'heic', 'webp']
const PRESTASHOP_FORMATS: ImageFormat[] = ['gif', 'jpeg', 'png']
const GOOGLE_FORMATS: ImageFormat[] = ['jpeg', 'webp', 'png', 'gif', 'bmp', 'tiff']

export const PLATFORMS: Platform[] = [
  {
    id: 'olx',
    name: 'OLX',
    scope: 'ogłoszenia OLX.pl – dokumentacja eksportu ogłoszeń przez API dla partnerów OLX Group',
    landing: '/zdjecia-produktowe-olx',
    checkedAt: CHECKED_AT,
    sources: [{ id: 'olx-api', label: 'OLX Group Developer – walidacje eksportu ogłoszeń (OLX.pl)', url: 'https://developer.olxgroup.com/docs/validations-required-for-olx-export' }],
    requirements: [
      { label: 'Krótszy bok', value: 'co najmniej 300 px', source: 'olx-api', rule: { kind: 'minShortSide', px: 300, severity: 'fail' } },
      { label: 'Waga pliku', value: 'maks. 5 MB', source: 'olx-api', rule: { kind: 'maxBytes', bytes: 5 * MB } },
    ],
    notes: [{ text: 'Wartości pochodzą z dokumentacji eksportu przez API; centrum pomocy OLX wymaga zalogowania, więc limitów formularza w aplikacji nie mogliśmy sprawdzić.', source: 'olx-api' }],
    undocumented: ['Akceptowane formaty plików', 'Zalecany rozmiar zdjęcia'],
  },
  {
    id: 'vinted',
    name: 'Vinted',
    scope: 'zdjęcia przedmiotów w ogłoszeniach',
    landing: '/zdjecia-produktowe-vinted',
    checkedAt: CHECKED_AT,
    sources: [
      { id: 'vinted-rules', label: 'Vinted – zasady katalogu (Catalog rules)', url: 'https://www.vinted.com/catalog-rules' },
      { id: 'vinted-help', label: 'Vinted – pomoc: jak robić dobre zdjęcia', url: 'https://www.vinted.co.uk/help/48' },
    ],
    requirements: [],
    notes: [
      { text: 'Do 20 zdjęć w ogłoszeniu; pierwsze pokazuje cały przedmiot.', source: 'vinted-rules' },
      { text: 'Zdjęcia ostre, zrobione przez Ciebie i pokazujące przedmiot takim, jaki jest – bez edycji obrazu.', source: 'vinted-rules' },
      { text: 'Bez zdjęć stockowych, z reklam i ze znakiem wodnym.', source: 'vinted-rules' },
      { text: 'Bez filtrów i lampy błyskowej; bez kolaży na pierwszym zdjęciu.', source: 'vinted-help' },
    ],
    undocumented: ['Akceptowane formaty plików', 'Minimalne wymiary', 'Maksymalna waga pliku'],
  },
  {
    id: 'ebay',
    name: 'eBay',
    scope: 'zdjęcia w ofertach',
    landing: '/zdjecia-produktowe-ebay',
    checkedAt: CHECKED_AT,
    sources: [
      { id: 'ebay-policy', label: 'eBay – Picture policy', url: 'https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370' },
      { id: 'ebay-adding', label: 'eBay – Adding pictures to your listings', url: 'https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148' },
    ],
    requirements: [
      { label: 'Dłuższy bok', value: 'co najmniej 500 px', source: 'ebay-policy', rule: { kind: 'minLongSide', px: 500, severity: 'fail' } },
      { label: 'Rozdzielczość minimalna', value: '500 × 500 px', source: 'ebay-adding', rule: { kind: 'minShortSide', px: 500, severity: 'warn' } },
      { label: 'Zalecany rozmiar', value: 'ok. 1600 × 1600 px', source: 'ebay-adding', rule: { kind: 'recommendedLongSide', px: 1600 } },
      { label: 'Waga pliku', value: 'maks. 12 MB', source: 'ebay-adding', rule: { kind: 'maxBytes', bytes: 12 * MB } },
      { label: 'Formaty', value: fmt(EBAY_FORMATS), source: 'ebay-adding', rule: { kind: 'formats', accepted: EBAY_FORMATS, severity: 'fail' } },
      {
        label: 'Proporcje',
        value: '1:1 lub 16:9 wyglądają najlepiej',
        source: 'ebay-adding',
        rule: {
          kind: 'ratios',
          ratios: [
            [1, 1],
            [16, 9],
          ],
          reason: 'eBay zaleca 1:1 lub 16:9',
        },
      },
    ],
    notes: [
      { text: 'Bez dodanych ramek, tekstu, grafik marketingowych i znaków wodnych.', source: 'ebay-policy' },
      { text: 'Od 1 do 24 zdjęć w ofercie; zalecane neutralne, najlepiej białe tło.', source: 'ebay-adding' },
    ],
    undocumented: [],
  },
  {
    id: 'amazon',
    name: 'Amazon (zdjęcie główne)',
    scope: 'zdjęcie główne oferty',
    landing: '/zdjecia-produktowe-amazon',
    checkedAt: CHECKED_AT,
    sources: [
      {
        id: 'amazon-forum',
        label: 'Amazon Seller Central – „Product Image Requirements and Best Practices” (wpis pracownika Amazon; strona pomocy G1881 wymaga logowania)',
        url: 'https://sellercentral.amazon.com/seller-forums/discussions/t/13af96ea-6b07-4bf9-8dbe-a13292c2e3b1',
      },
    ],
    requirements: [
      { label: 'Formaty', value: fmt(AMAZON_FORMATS), source: 'amazon-forum', rule: { kind: 'formats', accepted: AMAZON_FORMATS, severity: 'fail' } },
      { label: 'Dłuższy bok (powiększanie)', value: 'co najmniej 1000 px, by działał zoom', source: 'amazon-forum', rule: { kind: 'recommendedLongSide', px: 1000 } },
      { label: 'Tło zdjęcia głównego', value: 'czysta biel (RGB 255, 255, 255)', source: 'amazon-forum', rule: { kind: 'whiteBackground' } },
      { label: 'Przezroczystość', value: 'tło ma być czysto białe – przezroczyste tło nie jest bielą', source: 'amazon-forum', rule: { kind: 'noTransparency' } },
    ],
    notes: [
      { text: 'Produkt wypełnia co najmniej 85% kadru.', source: 'amazon-forum' },
      { text: 'Bez dodatkowego tekstu, grafik i znaków wodnych.', source: 'amazon-forum' },
      { text: 'Tryb kolorów RGB lub CMYK.', source: 'amazon-forum' },
    ],
    undocumented: [],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    scope: 'zdjęcia produktów i kolekcji',
    landing: SHOP,
    checkedAt: CHECKED_AT,
    sources: [{ id: 'shopify-media', label: 'Shopify Help Center – typy mediów produktu', url: 'https://help.shopify.com/en/manual/products/product-media/product-media-types' }],
    requirements: [
      { label: 'Formaty', value: `${fmt(SHOPIFY_FORMATS)} (oraz SVG)`, source: 'shopify-media', rule: { kind: 'formats', accepted: SHOPIFY_FORMATS, severity: 'fail' } },
      { label: 'Maksymalne wymiary', value: '5000 × 5000 px', source: 'shopify-media', rule: { kind: 'maxSide', px: 5000 } },
      { label: 'Maksymalna rozdzielczość', value: '25 MP', source: 'shopify-media', rule: { kind: 'maxMegapixels', mp: 25 } },
      { label: 'Waga pliku', value: 'mniej niż 20 MB', source: 'shopify-media', rule: { kind: 'maxBytes', bytes: 20 * MB, strictlyLess: true } },
      { label: 'Zalecany rozmiar', value: 'kwadrat 2048 × 2048 px zwykle wygląda najlepiej', source: 'shopify-media', rule: { kind: 'recommendedLongSide', px: 2048 } },
    ],
    notes: [{ text: 'Zdjęcia główne produktów w jednej, spójnej proporcji – wtedy w kolekcji mają ten sam rozmiar.', source: 'shopify-media' }],
    undocumented: ['Minimalne wymiary'],
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    scope: 'domyślne rozmiary obrazów – motyw może je zmienić',
    landing: SHOP,
    checkedAt: CHECKED_AT,
    sources: [{ id: 'woo-sizes', label: 'WooCommerce Developer Docs – rozmiary obrazów', url: 'https://developer.woocommerce.com/docs/theming/theme-development/image-sizes/' }],
    requirements: [
      { label: 'Zdjęcie produktu (woocommerce_single)', value: 'domyślnie 600 px szerokości, bez przycinania', source: 'woo-sizes', rule: { kind: 'minWidth', px: 600, severity: 'warn' } },
      {
        label: 'Miniatura w siatce (woocommerce_thumbnail)',
        value: 'domyślnie 300 px, przycinana do kwadratu',
        source: 'woo-sizes',
        rule: { kind: 'ratios', ratios: [[1, 1]], reason: 'domyślnie miniatury w siatce są przycinane do kwadratu' },
      },
    ],
    notes: [{ text: 'Miniatury galerii mają domyślnie 100 × 100 px; proporcję przycinania ustawisz w Customizerze.', source: 'woo-sizes' }],
    undocumented: ['Akceptowane formaty plików', 'Maksymalna waga pliku'],
  },
  {
    id: 'shoper',
    name: 'Shoper',
    scope: 'galeria produktu (zależy od szablonu)',
    landing: SHOP,
    checkedAt: CHECKED_AT,
    sources: [
      { id: 'shoper-formats', label: 'Shoper – pomoc: formaty zdjęć produktów', url: 'https://www.shoper.pl/help/artykul/formaty-zdjec-produktow/' },
      { id: 'shoper-add', label: 'Shoper Learn – jak dodać zdjęcie do produktu', url: 'https://www.shoper.pl/learn/artykul/jak-dodac-zdjecie-do-produktu' },
    ],
    requirements: [{ label: 'Dłuższy bok', value: 'sugerowane 1000 px (maksymalnie 1000 px)', source: 'shoper-formats', rule: { kind: 'suggestedLongSide', px: 1000 } }],
    notes: [
      { text: 'W szablonie Storefront zdjęcia są automatycznie zamieniane na WebP.', source: 'shoper-formats' },
      { text: 'W starszych szablonach pliki bez tła zachowują przezroczystość.', source: 'shoper-formats' },
      { text: 'Dłuższy bok zdjęcia powinien mieć maksymalnie 1000 px.', source: 'shoper-add' },
    ],
    undocumented: ['Akceptowane formaty plików', 'Maksymalna waga pliku'],
  },
  {
    id: 'prestashop',
    name: 'PrestaShop',
    scope: 'PrestaShop 9 – przesyłanie zdjęć produktów przez webservice',
    landing: SHOP,
    checkedAt: CHECKED_AT,
    sources: [
      { id: 'presta-ws', label: 'PrestaShop 9 – dokumentacja webservice: images', url: 'https://devdocs.prestashop-project.org/9/webservice/resources/images' },
      {
        id: 'presta-settings',
        label: 'PrestaShop 9 – dokumentacja: ustawienia obrazów',
        url: 'https://docs.prestashop-project.org/v.9-documentation/user-guide/improving-shop/customizing-store-design/image-settings',
      },
    ],
    requirements: [{ label: 'Formaty (webservice)', value: fmt(PRESTASHOP_FORMATS), source: 'presta-ws', rule: { kind: 'formats', accepted: PRESTASHOP_FORMATS, severity: 'warn' } }],
    notes: [
      { text: 'Wystarczy jeden duży plik – sklep sam generuje z niego wszystkie rozmiary.', source: 'presta-settings' },
      { text: 'Proporcja zdjęcia zgodna z ustawieniami rozmiarów obrazów zapobiega białym pasom.', source: 'presta-settings' },
    ],
    undocumented: ['Domyślne rozmiary w pikselach', 'Maksymalna waga pliku (zależy od ustawień PHP serwera)'],
  },
  {
    id: 'google',
    name: 'Google Merchant Center',
    scope: 'zdjęcie produktu w pliku danych (image_link)',
    landing: SHOP,
    checkedAt: CHECKED_AT,
    sources: [{ id: 'gmc-image', label: 'Pomoc Google Merchant Center – zdjęcie produktu (image_link)', url: 'https://support.google.com/merchants/answer/6324350?hl=pl' }],
    requirements: [
      { label: 'Formaty', value: fmt(GOOGLE_FORMATS), source: 'gmc-image', rule: { kind: 'formats', accepted: GOOGLE_FORMATS, severity: 'fail' } },
      {
        label: 'Minimalne wymiary',
        value: '500 × 500 px dla wszystkich produktów od 31 stycznia 2027 r.',
        source: 'gmc-image',
        rule: { kind: 'minShortSide', px: 500, severity: 'fail', effectiveFrom: '2027-01-31' },
      },
      { label: 'Zalecany rozmiar', value: 'co najmniej 1500 × 1500 px', source: 'gmc-image', rule: { kind: 'recommendedShortSide', px: 1500 } },
      { label: 'Maksymalna rozdzielczość', value: '64 MP', source: 'gmc-image', rule: { kind: 'maxMegapixels', mp: 64 } },
      { label: 'Waga pliku', value: 'maks. 16 MB', source: 'gmc-image', rule: { kind: 'maxBytes', bytes: 16 * MB } },
    ],
    notes: [{ text: 'Bez ramek, nałożonego tekstu promocyjnego i znaków wodnych; produkt dobrze widoczny.', source: 'gmc-image' }],
    undocumented: [],
  },
]

// ── evaluation ───────────────────────────────────────────────────────────────

export interface CheckResult {
  requirement: Requirement
  status: Status
  message: string
}

export interface PlatformResult {
  platform: Platform
  status: Status
  checks: CheckResult[]
}

const RANK: Record<Status, number> = { info: 0, pass: 1, warn: 2, fail: 3 }
/** 1600 → "1600 px", 30000 → "30 000 px" (no locale differences between browsers). */
const px = (n: number) => `${n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : n} px`
const mbLabel = (bytes: number) => `${(bytes / MB).toString().replace('.', ',')} MB`

function check(req: Requirement, a: ImageAnalysis, today: string): CheckResult {
  const r = req.rule
  const w = a.width ?? 0
  const h = a.height ?? 0
  const long = Math.max(w, h)
  const short = Math.min(w, h)
  const res = (status: Status, message: string): CheckResult => ({ requirement: req, status, message })

  switch (r.kind) {
    case 'formats':
      return r.accepted.includes(a.format)
        ? res('pass', `Format ${FORMAT_LABEL[a.format]} jest na liście.`)
        : res(r.severity, `Format ${FORMAT_LABEL[a.format]} nie jest na liście (${fmt(r.accepted)}).`)
    case 'minLongSide':
      return long >= r.px ? res('pass', `Dłuższy bok ${px(long)} ≥ ${px(r.px)}.`) : res(r.severity, `Dłuższy bok ma ${px(long)}, wymagane co najmniej ${px(r.px)}.`)
    case 'minShortSide': {
      if (short >= r.px) return res('pass', `Krótszy bok ${px(short)} ≥ ${px(r.px)}.`)
      if (r.effectiveFrom && today < r.effectiveFrom) return res('warn', `Krótszy bok ma ${px(short)}; od ${r.effectiveFrom.split('-').reverse().join('.')} wymagane co najmniej ${px(r.px)}.`)
      return res(r.severity, `Krótszy bok ma ${px(short)}, wymagane co najmniej ${px(r.px)}.`)
    }
    case 'minWidth':
      return w >= r.px
        ? res('pass', `Szerokość ${px(w)} ≥ ${px(r.px)}.`)
        : res(r.severity, `Szerokość ${px(w)} jest mniejsza niż ${px(r.px)} – zdjęcie produktu zostanie powiększone albo wyświetlone mniejsze.`)
    case 'recommendedLongSide':
      return long >= r.px ? res('pass', `Dłuższy bok ${px(long)} ≥ zalecanych ${px(r.px)}.`) : res('warn', `Dłuższy bok ma ${px(long)} – mniej niż zalecane ${px(r.px)}.`)
    case 'recommendedShortSide':
      return short >= r.px ? res('pass', `Krótszy bok ${px(short)} ≥ zalecanych ${px(r.px)}.`) : res('warn', `Krótszy bok ma ${px(short)} – mniej niż zalecane ${px(r.px)}.`)
    case 'suggestedLongSide':
      if (long === r.px) return res('pass', `Dłuższy bok ma dokładnie sugerowane ${px(r.px)}.`)
      return res('warn', long < r.px ? `Dłuższy bok ma ${px(long)} – mniej niż sugerowane ${px(r.px)}.` : `Dłuższy bok ma ${px(long)} – więcej niż sugerowane ${px(r.px)}.`)
    case 'maxSide':
      return long <= r.px ? res('pass', `Dłuższy bok ${px(long)} ≤ ${px(r.px)}.`) : res('fail', `Dłuższy bok ma ${px(long)}, maksimum to ${px(r.px)}.`)
    case 'maxMegapixels': {
      const mp = (w * h) / 1_000_000
      const label = mp.toFixed(1).replace('.', ',')
      return mp <= r.mp ? res('pass', `${label} MP ≤ ${r.mp} MP.`) : res('fail', `Zdjęcie ma ${label} MP, maksimum to ${r.mp} MP.`)
    }
    case 'maxBytes': {
      const ok = r.strictlyLess ? a.bytes < r.bytes : a.bytes <= r.bytes
      const size = (a.bytes / MB).toFixed(2).replace('.', ',')
      return ok ? res('pass', `Plik waży ${size} MB (limit ${mbLabel(r.bytes)}).`) : res('fail', `Plik waży ${size} MB, limit to ${mbLabel(r.bytes)}.`)
    }
    case 'ratios': {
      const value = w / h
      const hit = r.ratios.find(([x, y]) => Math.abs(value - x / y) / (x / y) <= 0.01)
      return hit ? res('pass', `Proporcje ${hit[0]}:${hit[1]}.`) : res('warn', `Proporcje ${a.ratio?.label ?? '?'} – ${r.reason}.`)
    }
    case 'whiteBackground': {
      const p = a.pixels
      if (!p) return res('info', 'Nie można ocenić tła – przeglądarka nie odczytała pikseli tego pliku.')
      const v = p.border.verdict
      const pct = Math.round(p.border.pureWhiteShare * 100)
      if (v === 'white') return res('pass', `Szacunek: ${pct}% pikseli przy krawędziach to czysta biel.`)
      if (v === 'light') return res('warn', `Szacunek: tło jest jasne, ale tylko ${pct}% pikseli przy krawędziach to czysta biel (255, 255, 255).`)
      if (v === 'transparent') return res('warn', 'Szacunek: tło przy krawędziach jest przezroczyste, a nie białe.')
      return res('warn', `Szacunek: tło przy krawędziach nie jest białe (czysta biel: ${pct}% pikseli).`)
    }
    case 'noTransparency': {
      if (a.pixels) return a.pixels.transparentShare > 0 ? res('warn', 'Zdjęcie ma przezroczyste piksele – wypełnij tło czystą bielą.') : res('pass', 'Brak przezroczystych pikseli.')
      if (a.hasAlphaChannel === false) return res('pass', 'Format bez kanału przezroczystości.')
      if (a.hasAlphaChannel) return res('warn', 'Plik ma kanał przezroczystości – upewnij się, że tło jest wypełnione bielą.')
      return res('info', 'Nie można sprawdzić przezroczystości tego pliku.')
    }
  }
}

/** pass / warn / fail for one platform; `today` (YYYY-MM-DD) decides rules that apply from a future date. */
export function evaluatePlatform(platform: Platform, analysis: ImageAnalysis, today: string): PlatformResult {
  if (analysis.error) return { platform, status: 'info', checks: [] }
  const checks = platform.requirements.map((r) => check(r, analysis, today))
  const status = checks.reduce<Status>((worst, c) => (RANK[c.status] > RANK[worst] ? c.status : worst), 'info')
  return { platform, status, checks }
}

export function evaluateAll(analysis: ImageAnalysis, today: string): PlatformResult[] {
  return PLATFORMS.map((p) => evaluatePlatform(p, analysis, today))
}

export const STATUS_LABEL: Record<Status, string> = {
  pass: 'Zgodne',
  warn: 'Uwaga',
  fail: 'Niezgodne',
  info: 'Brak danych',
}

/** Platforms whose documented format list leaves HEIC out / includes it (FAQ and HEIC tip). */
export function heicSupport(): { accepted: string[]; rejected: string[] } {
  const accepted: string[] = []
  const rejected: string[] = []
  for (const p of PLATFORMS) {
    const rule = p.requirements.find((r) => r.rule.kind === 'formats')?.rule
    if (!rule || rule.kind !== 'formats') continue
    ;(rule.accepted.includes('heic') ? accepted : rejected).push(p.name.replace(' (zdjęcie główne)', ''))
  }
  return { accepted, rejected }
}

export function sourceOf(platform: Platform, id: string): Source {
  const s = platform.sources.find((x) => x.id === id)
  if (!s) throw new Error(`${platform.id}: unknown source ${id}`)
  return s
}
