/**
 * Blog topic clusters (spec 10, AC-SEO-017): every cluster has a hub section on /blog and a pillar page – one of the
 * landing pages – that its posts link to. A post belongs to at most one cluster; posts outside every cluster (e.g. a
 * fresh post from the daily bot) are listed under "Pozostałe poradniki" until someone assigns them here.
 * Keyword → URL map: docs/seo/2026-10-ecommerce-seo-audit.md.
 */
import botLedger from '../../scripts/blog-keywords-used.json' with { type: 'json' }
import { blogIndex } from './blogIndex'

export interface TopicCluster {
  id: string
  /** H2 of the hub section on /blog. */
  name: string
  intro: string
  /** Pillar landing page(s), first one is the main pillar. */
  pillars: string[]
  /** Post slugs, the most important (hub-defining) first. */
  posts: string[]
}

const curatedClusters: TopicCluster[] = [
  {
    id: 'zdjecia-produktowe-ai',
    name: 'Zdjęcia produktowe AI',
    intro: 'Jak działa generator zdjęć produktowych, jak przygotować zdjęcie wejściowe, gdzie grafiki AI są dozwolone i jak obsłużyć cały katalog naraz.',
    pillars: ['/zdjecia-ai-do-ofert'],
    posts: [
      'jak-wykorzystac-ai-do-zdjec-produktowych',
      'jak-przygotowac-zdjecie-do-generatora-ai',
      'jak-ai-generuje-opisy-i-style-miniaturek',
      'batch-processing-zdjecia-produktowe-szybko-i-latwo',
      'automatyzacja-workflow-graficznego-sklepy-500-sku',
    ],
  },
  {
    id: 'fotografia-produktowa',
    name: 'Fotografia produktowa w praktyce',
    intro: 'Zdjęcia produktów telefonem i w domu: światło, tło, ujęcia dla różnych kategorii i koszty – od zdjęć DIY po studio i AI.',
    pillars: ['/fotografia-produktowa-ai'],
    posts: [
      'jak-zrobic-profesjonalne-zdjecia-produktow',
      'zdjecia-produktow-telefonem-poradnik',
      'koszty-fotografii-produktowej-vs-ai-roi',
      'oswietlenie-diy-do-zdjec-produktowych',
      'zdjecia-produktowe-dla-kategorii-poradnik',
      'jak-fotografowac-buty-do-sprzedazy',
      'zdjecie-produktu-w-folii-i-opakowaniu',
      'flat-lay-jak-tworzyc-estetyczne-uklady-produktow',
      'zdjecia-produktow-premium-jak-je-przygotowac',
    ],
  },
  {
    id: 'packshot-i-tlo',
    name: 'Packshot, białe tło i style zdjęć',
    intro: 'Packshot na białym tle, usuwanie tła, ciemne tło i sceny lifestyle – który styl zdjęcia wybrać i gdzie go użyć.',
    pillars: ['/packshot-online', '/biale-tlo-zdjecie-produktu'],
    posts: [
      'najlepsze-style-zdjec-produktowych',
      'biale-tlo-diy-vs-ai-w-fotografii-produktowej',
      'jak-usunac-tlo-ze-zdjecia-produktu',
      'biale-tlo-vs-lifestyle-jaki-styl-zdjecia-produktu',
      'dark-luxury-ciemne-tlo-na-zdjeciu-produktu',
      'wplyw-tla-miniaturki-na-postrzegana-wartosc-produktu',
      'jak-styl-miniaturki-wplywa-na-postrzeganie-produktu',
    ],
  },
  {
    id: 'sklep-internetowy',
    name: 'Zdjęcia w sklepie internetowym',
    intro: 'Rozmiary i formaty plików, SEO zdjęć, wersja mobilna, spójny wygląd katalogu oraz grafiki sezonowe i promocyjne we własnym sklepie.',
    pillars: ['/zdjecia-produktowe-do-sklepu-internetowego'],
    posts: [
      'jaki-rozmiar-zdjecia-do-sklepu-internetowego',
      'jpg-vs-webp-vs-png-format-zdjec-produktowych',
      'seo-zdjec-produktowych',
      'spojna-identyfikacja-wizualna-sklepu-internetowego',
      'porownanie-platform-e-commerce-wymagania-graficzne',
      'zdjecia-produktow-na-urzadzenia-mobilne',
      'jak-tworzyc-grafiki-swiateczne-i-promocyjne',
      'jak-dostosowac-miniaturki-do-sezonowych-kampanii',
    ],
  },
  {
    id: 'marketplace',
    name: 'Zdjęcia na OLX, Vinted, eBay i Amazon',
    intro: 'Wymiary i limity zdjęć, zasady zdjęcia głównego, tytuły ogłoszeń i prawa do zdjęć na platformach sprzedażowych.',
    pillars: ['/zdjecia-produktowe-olx', '/zdjecia-produktowe-vinted', '/zdjecia-produktowe-ebay', '/zdjecia-produktowe-amazon'],
    posts: [
      'wymiary-zdjec-olx-vinted-ebay-amazon',
      'zdjecie-glowne-oferty-wymagania-platform',
      'jak-napisac-tytul-ogloszenia-olx-vinted-ebay',
      'prawa-autorskie-do-zdjec-produktow',
      'jak-budowac-zaufanie-kupujacych-zdjeciami',
    ],
  },
  {
    id: 'sprzedaz-i-konwersja',
    name: 'Opisy, konwersja i testy',
    intro: 'Opis produktu, kolejność zdjęć, testy A/B, metryki i mniej zwrotów – jak zdjęcia, tytuł i opis przekładają się na sprzedaż.',
    pillars: ['/zdjecia-produktowe-do-sklepu-internetowego', '/zdjecia-ai-do-ofert'],
    posts: [
      'jak-napisac-opis-produktu-do-sklepu-i-ogloszenia',
      'jak-zwiekszyc-sprzedaz-online-zdjecia-tytul-opis',
      'optymalizacja-konwersji-oferty-grafika-i-cena',
      'jak-zwiekszyc-ctr-ab-testowanie-miniaturek',
      'jak-testowac-miniaturki-bez-duzego-budzetu',
      'metryki-sprzedazy-co-mierzyc-poza-ctr',
      'jak-zmniejszyc-zwroty-dzieki-lepszym-zdjeciom',
    ],
  },
  {
    id: 'psychologia-zdjec',
    name: 'Psychologia zdjęć produktowych',
    intro: 'Kompozycja, kolory, percepcja i cena: jak kupujący odbiera zdjęcie produktu i jak wyróżnić ofertę na liście wyników.',
    pillars: ['/fotografia-produktowa-ai', '/packshot-online'],
    posts: [
      'psychologia-percepcji-wizualnej-w-e-commerce',
      'psychologia-kompozycji-zdjec-produktowych',
      'psychologia-kolorow-w-zdjeciach-produktowych',
      'psychologia-cen-a-styl-miniaturki',
      'jak-miniaturki-wplywaja-na-zakupowe-decyzje-klienta',
      'jak-zdjecia-produktow-wplywaja-na-postrzeganie-marki',
      'jak-wyroznic-zdjecie-produktu-wsrod-konkurencji',
    ],
  },
]

/**
 * AC-SEO-037: the blog bot (spec 23) plans topics in its own clusters (scripts/blog-keywords.json). A bot post that no
 * one placed above joins the blog cluster its plan cluster maps to, so it is never an orphan in "Podobne wpisy".
 */
export const PLAN_TO_BLOG_CLUSTER: Record<string, string> = {
  'fotografia-produktowa': 'fotografia-produktowa',
  'zdjecia-wg-kategorii': 'fotografia-produktowa',
  'sprzedaz-i-konwersja': 'sprzedaz-i-konwersja',
  'seo-sklepu': 'sklep-internetowy',
  'kanaly-sprzedazy': 'marketplace',
  'sezon-i-kampanie': 'sklep-internetowy',
  'ai-w-ecommerce': 'zdjecia-produktowe-ai',
  'prawo-i-praktyka': 'sklep-internetowy',
}

function withBotPosts(clusters: TopicCluster[]): TopicCluster[] {
  const placed = new Set(clusters.flatMap((c) => c.posts))
  const live = new Set(blogIndex.map((p) => p.slug))
  const extra = new Map<string, string[]>()
  for (const entry of botLedger as Array<{ slug?: string; cluster?: string }>) {
    const target = entry.cluster ? PLAN_TO_BLOG_CLUSTER[entry.cluster] : undefined
    if (!entry.slug || !target || placed.has(entry.slug) || !live.has(entry.slug)) continue
    placed.add(entry.slug)
    extra.set(target, [...(extra.get(target) ?? []), entry.slug])
  }
  return clusters.map((c) => ({ ...c, posts: [...c.posts, ...(extra.get(c.id) ?? [])] }))
}

export const topicClusters: TopicCluster[] = withBotPosts(curatedClusters)

export function clusterOfPost(slug: string): TopicCluster | undefined {
  return topicClusters.find((c) => c.posts.includes(slug))
}
