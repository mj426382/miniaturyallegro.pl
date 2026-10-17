/**
 * SEO landing pages – metadata only (spec 10, AC-SEO-007/014). The copy of each page (lead, sections, FAQ, sources)
 * lives in src/data/seoContent/<slug>.ts and loads lazily, like blog posts, so the shared bundle stays small.
 *
 * Since 2026-10-17 the site targets e-commerce in general: own online shops and marketplaces (OLX, Vinted, eBay,
 * Amazon) – no marketplace integrations, only export presets and descriptions. Keyword → URL map:
 * docs/seo/2026-10-ecommerce-seo-audit.md. Platform rules quoted in the copy come from official help pages listed in
 * each page's `sources`; re-check them when bumping SEO_PAGES_UPDATED.
 *
 * Parsed with regexes – keep the format:
 * - scripts/prerender.js, scripts/generate-sitemap.js and scripts/generate-og-image.js read the `path:` lines (one per page);
 * - the blog bot (scripts/generate-blog-post.py) reads `path`, `h1` and `keywords` in that order and skips the
 *   keywords (they belong to the page). `h1` and `keywords` use single quotes and never contain an apostrophe.
 */
export interface SeoPage {
  path: string
  /** Short name used in the footer, on the home page cards and in "see also" links. */
  navLabel: string
  /** <title> without the " | AllGrafika.pl" suffix – at most 44 characters, so the brand fits within 60. */
  title: string
  /** Meta description, 120–158 characters, main phrase first. */
  description: string
  h1: string
  h1Accent: string
  /** Search phrases this page answers (reserved: the blog bot skips them). Most important first. */
  keywords: string[]
  /** One sentence for the cards that link to this page. */
  teaser: string
  /** Blog posts that go deeper (internal links). */
  related: string[]
}

/** Sitemap <lastmod> of the landing pages and the date shown on them – bump it when their copy changes. */
export const SEO_PAGES_UPDATED = '2026-10-17'

export const seoPages: SeoPage[] = [
  {
    path: '/zdjecia-ai-do-ofert',
    navLabel: 'Generator zdjęć produktowych AI',
    title: 'Generator zdjęć produktowych AI – online',
    description: 'Generator zdjęć produktowych AI online: wgraj zdjęcie z telefonu i pobierz packshot, aranżację lub scenę sezonową do sklepu i ogłoszeń. 5 grafik gratis.',
    h1: 'Generator zdjęć produktowych AI',
    h1Accent: 'z jednego zdjęcia z telefonu',
    keywords: ['generator zdjęć produktowych ai', 'zdjęcia ai do ofert', 'generator zdjęć produktowych', 'zdjęcia produktowe z ai'],
    teaser: 'Jak działa generator, jakie style daje i jak chroni wygląd produktu.',
    related: ['jak-przygotowac-zdjecie-do-generatora-ai', 'jak-wykorzystac-ai-do-zdjec-produktowych', 'jak-ai-generuje-opisy-i-style-miniaturek'],
  },
  {
    path: '/fotografia-produktowa-ai',
    navLabel: 'Fotografia produktowa AI',
    title: 'Fotografia produktowa AI – sesja bez studia',
    description: 'Fotografia produktowa AI: kiedy zastąpi sesję produktową, a kiedy nie. Porównanie studia, zdjęć DIY i AI – koszt, czas, jakość – plus proces krok po kroku.',
    h1: 'Fotografia produktowa AI',
    h1Accent: 'sesja produktowa bez studia i fotografa',
    keywords: ['fotografia produktowa ai', 'sesja produktowa ai', 'fotografia produktowa', 'sesja produktowa', 'zdjęcia produktowe bez fotografa'],
    teaser: 'Studio, zdjęcia DIY czy AI – uczciwe porównanie kosztów, czasu i ograniczeń.',
    related: ['koszty-fotografii-produktowej-vs-ai-roi', 'jak-zrobic-profesjonalne-zdjecia-produktow', 'zdjecia-produktow-telefonem-poradnik'],
  },
  {
    path: '/packshot-online',
    navLabel: 'Packshot online',
    title: 'Packshot online – co to jest i jak go zrobić',
    description: 'Packshot – co to jest, jakie ujęcia obejmuje i ile kosztuje w studiu. Zobacz, jak zrobić packshot online z AI ze zdjęcia z telefonu, bez namiotu i lamp.',
    h1: 'Packshot online',
    h1Accent: 'co to jest i jak go zrobić bez studia',
    keywords: ['packshot online', 'packshot co to', 'packshot ai', 'jak zrobić packshot', 'packshot generator'],
    teaser: 'Czym jest packshot, jakie ujęcia obejmuje i jak zrobić go z AI.',
    related: ['najlepsze-style-zdjec-produktowych', 'biale-tlo-vs-lifestyle-jaki-styl-zdjecia-produktu', 'zdjecie-glowne-oferty-wymagania-platform'],
  },
  {
    path: '/biale-tlo-zdjecie-produktu',
    navLabel: 'Zdjęcie produktu na białym tle',
    title: 'Zdjęcie produktu na białym tle – online',
    description: 'Zdjęcie produktu na białym tle online, bez Photoshopa i studia: wgraj fotkę z telefonu, a AI zrobi białe tło z naturalnym cieniem pod sklep i Amazon.',
    h1: 'Zdjęcie produktu na białym tle',
    h1Accent: 'online, w kilka minut, bez studia',
    keywords: ['zdjęcie produktu na białym tle', 'jak zrobić zdjęcie produktu na białym tle', 'zdjęcie na białym tle aplikacja', 'białe tło zdjęcie online', 'białe tło do zdjęć produktowych online'],
    teaser: 'Białe tło z naturalnym cieniem z każdego zdjęcia z telefonu.',
    related: ['biale-tlo-diy-vs-ai-w-fotografii-produktowej', 'jak-usunac-tlo-ze-zdjecia-produktu', 'zdjecie-produktu-w-folii-i-opakowaniu'],
  },
  {
    path: '/zdjecia-produktowe-do-sklepu-internetowego',
    navLabel: 'Zdjęcia do sklepu internetowego',
    title: 'Zdjęcia produktowe do sklepu internetowego',
    description: 'Zdjęcia do sklepu internetowego: jakie ujęcia na karcie produktu, rozmiary w Shopify, WooCommerce, Shoper i PrestaShop oraz wymagania Google Merchant Center.',
    h1: 'Zdjęcia produktowe do sklepu internetowego',
    h1Accent: 'karta produktu, galeria i Google Zakupy',
    keywords: ['zdjęcia do sklepu internetowego', 'zdjęcia produktów do sklepu internetowego', 'jak zrobić dobre zdjęcia do sklepu internetowego', 'zdjęcia produktowe do sklepu'],
    teaser: 'Zestaw zdjęć karty produktu i ustawienia Shopify, WooCommerce, Shoper, PrestaShop.',
    related: ['jaki-rozmiar-zdjecia-do-sklepu-internetowego', 'seo-zdjec-produktowych', 'spojna-identyfikacja-wizualna-sklepu-internetowego'],
  },
  {
    path: '/zdjecia-produktowe-olx',
    navLabel: 'Zdjęcia na OLX',
    title: 'Zdjęcia do ogłoszeń OLX – jak je zrobić',
    description: 'Zdjęcia do ogłoszeń OLX: jak sfotografować przedmiot telefonem, co pokazać, czego unikać i jaki format wybrać, plus preset eksportu i opis ogłoszenia pod OLX.',
    h1: 'Zdjęcia do ogłoszeń OLX',
    h1Accent: 'wyraźne, uczciwe i gotowe w minutę',
    keywords: ['zdjęcia do ogłoszeń olx', 'zdjęcia na olx', 'zdjęcia produktowe olx', 'jakie zdjęcia na olx'],
    teaser: 'Co pokazać na zdjęciach ogłoszenia i jak przygotować kadr pod OLX.',
    related: ['wymiary-zdjec-olx-vinted-ebay-amazon', 'jak-napisac-tytul-ogloszenia-olx-vinted-ebay', 'zdjecia-produktow-telefonem-poradnik'],
  },
  {
    path: '/zdjecia-produktowe-vinted',
    navLabel: 'Zdjęcia na Vinted',
    title: 'Zdjęcia na Vinted – zasady i wskazówki',
    description: 'Zdjęcia na Vinted: co mówią zasady katalogu (własne zdjęcia, bez edycji, bez AI), jak zrobić je telefonem i jak AllGrafika pomaga w kadrze i opisie.',
    h1: 'Zdjęcia na Vinted',
    h1Accent: 'zgodne z zasadami katalogu',
    keywords: ['zdjęcia na vinted', 'zdjęcia produktowe vinted', 'zdjęcia vinted zasady', 'zdjęcia na vinted ai'],
    teaser: 'Zasady katalogu Vinted: własne zdjęcia bez edycji – i co możesz zrobić w zamian.',
    related: ['zdjecia-produktow-telefonem-poradnik', 'jak-fotografowac-buty-do-sprzedazy', 'jak-budowac-zaufanie-kupujacych-zdjeciami'],
  },
  {
    path: '/zdjecia-produktowe-ebay',
    navLabel: 'Zdjęcia na eBay',
    title: 'Zdjęcia na eBay – wymagania i generator',
    description: 'Zdjęcia produktów na eBay: wymagania (min. 500 px, do 24 zdjęć, bez ramek i napisów), jak je przygotować z telefonu i jak zrobić packshot z AI w AllGrafika.',
    h1: 'Zdjęcia produktów na eBay',
    h1Accent: 'zgodne z zasadami zdjęć eBay',
    keywords: ['zdjęcia na ebay', 'zdjęcia produktów ebay', 'wymagania zdjęć ebay'],
    teaser: 'Wymagania eBay: rozmiar, liczba zdjęć i zakaz ramek, napisów i znaków wodnych.',
    related: ['wymiary-zdjec-olx-vinted-ebay-amazon', 'zdjecie-glowne-oferty-wymagania-platform', 'jak-napisac-tytul-ogloszenia-olx-vinted-ebay'],
  },
  {
    path: '/zdjecia-produktowe-amazon',
    navLabel: 'Zdjęcia na Amazon',
    title: 'Zdjęcia na Amazon – białe tło i wymagania',
    description: 'Zdjęcia produktów na Amazon: zdjęcie główne na czystym białym tle, produkt na 85% kadru, bez napisów. Zrób packshot z telefonu w AllGrafika. 5 grafik gratis.',
    h1: 'Zdjęcia produktów na Amazon',
    h1Accent: 'białe tło na zdjęciu głównym',
    keywords: ['zdjęcia na amazon', 'zdjęcia produktów amazon', 'amazon białe tło zdjęcie główne'],
    teaser: 'Zdjęcie główne na czystej bieli, produkt na 85% kadru, zdjęcia dodatkowe.',
    related: ['zdjecie-glowne-oferty-wymagania-platform', 'wymiary-zdjec-olx-vinted-ebay-amazon', 'jpg-vs-webp-vs-png-format-zdjec-produktowych'],
  },
]

export function findSeoPage(path: string): SeoPage | undefined {
  return seoPages.find((p) => p.path === path)
}

/** Content module name of a page: its path without the leading slash. */
export function seoSlug(page: Pick<SeoPage, 'path'>): string {
  return page.path.slice(1)
}

/** Per-page Open Graph image generated by scripts/generate-og-image.js (AC-SEO-019). */
export function seoOgImage(page: Pick<SeoPage, 'path'>): string {
  return `/og/${seoSlug(page)}.png`
}
