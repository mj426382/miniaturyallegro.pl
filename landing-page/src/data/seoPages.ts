/**
 * SEO landing pages for tool-intent queries (spec 10, AC-SEO-007). Research: Google autocomplete, 2026-10-09 –
 * "zdjęcia ai na allegro", "allegro zdjęcia ai", "generator zdjęć produktowych ai", "zdjęcie na białym tle
 * aplikacja", "białe tło zdjęcie online", "jak zrobić zdjęcia na białym tle do allegro".
 * Each page owns its queries; the blog bot does not write articles for them (scripts/blog-keywords.json).
 * scripts/prerender.js and scripts/generate-sitemap.js read the `path:` lines of this file – keep one per page.
 */
export interface SeoSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export interface SeoPage {
  path: string
  /** <title> without the " | AllGrafika.pl" suffix – at most 44 characters. */
  title: string
  /** Meta description, 120–160 characters. */
  description: string
  h1: string
  h1Accent: string
  lead: string
  /** Search phrases this page answers (reserved: the blog bot skips them). */
  keywords: string[]
  sections: SeoSection[]
  faq: Array<{ q: string; a: string }>
  /** Blog posts that go deeper (internal links). */
  related: string[]
}

/** Sitemap <lastmod> of the landing pages – bump it when their copy changes. */
export const SEO_PAGES_UPDATED = '2026-10-09'

export const seoPages: SeoPage[] = [
  {
    path: '/zdjecia-ai-allegro',
    title: 'Zdjęcia AI na Allegro – generator grafik',
    description: 'Generator zdjęć produktowych AI dla sprzedawców Allegro: zdjęcie z telefonu zamieniasz w grafikę na białym tle lub w aranżacji. 5 grafik za darmo.',
    h1: 'Zdjęcia AI na Allegro',
    h1Accent: 'z jednego zdjęcia z telefonu',
    lead: 'AllGrafika to generator zdjęć produktowych AI stworzony dla sprzedawców Allegro. Wgrywasz zwykłe zdjęcie produktu, a w kilka minut dostajesz grafiki na białym tle, w aranżacji wnętrza, w stylu sezonowym albo z produktem w użyciu – gotowe do wstawienia w ofertę.',
    keywords: ['zdjęcia ai na allegro', 'allegro zdjęcia ai', 'generator zdjęć produktowych ai', 'zdjęcia produktowe ai', 'grafika produktowa ai'],
    sections: [
      {
        heading: 'Jak działa generator zdjęć produktowych AI',
        paragraphs: [
          'Zaczynasz od zdjęcia zrobionego telefonem – na biurku, w folii albo na podłodze. AI rozpoznaje produkt, oddziela go od tła i buduje wokół niego nową scenę: czyste białe tło pod zdjęcie główne oferty albo aranżację, która pokazuje produkt w kontekście.',
          'Kształt, kolory, napisy i logo produktu są chronione regułami integralności – zmienia się tło, światło i scena, a nie to, co kupujący dostanie w paczce. Dlatego grafiki nadają się do ofert, a nie tylko do inspiracji.',
        ],
        bullets: [
          'Białe tło zgodne z wymaganiami zdjęcia głównego Allegro',
          '19 stylów: uniwersalne, sezonowe (święta, Black Friday) i branżowe',
          'Własna scena opisana po polsku, także na podstawie zdjęcia referencyjnego',
          'Opis oferty pod SEO Allegro gratis do każdego zdjęcia z grafiką',
        ],
      },
      {
        heading: 'Zdjęcia AI a regulamin Allegro',
        paragraphs: [
          'Allegro wymaga, żeby zdjęcia przedstawiały oferowany produkt zgodnie z rzeczywistością, a zdjęcie główne miało jasne, jednolite tło bez dodatkowych napisów. Grafiki z AI spełniają te zasady, jeśli produkt na nich jest wierny oryginałowi – i właśnie to jest rdzeniem AllGrafika.',
          'Na kolejnych zdjęciach oferty możesz używać aranżacji i infografik z cechami produktu. Przed publikacją zawsze porównaj grafikę z produktem: w aplikacji masz podgląd oryginału obok wyniku.',
        ],
      },
      {
        heading: 'Dla kogo są zdjęcia AI',
        paragraphs: [
          'Dla sprzedawców, którzy wystawiają wiele produktów i nie mają czasu ani budżetu na sesję zdjęciową dla każdego z nich. Masowe przesyłanie obsłuży całą dostawę naraz, a grafiki pobierzesz w paczce ZIP albo opublikujesz prosto w ofercie Allegro.',
        ],
        bullets: ['Sklepy z dziesiątkami i setkami SKU', 'Sprzedawcy produktów sezonowych', 'Odsprzedawcy towaru w fabrycznych opakowaniach'],
      },
    ],
    faq: [
      {
        q: 'Czy zdjęcia AI można wstawiać na Allegro?',
        a: 'Tak, jeśli przedstawiają prawdziwy produkt bez zmian w jego wyglądzie. AllGrafika zmienia tło i scenę, a chroni kształt, kolory i logo produktu. Zdjęcie główne generuj na białym tle.',
      },
      {
        q: 'Ile kosztuje wygenerowanie zdjęcia AI?',
        a: 'Pierwsze 5 grafik jest darmowych po potwierdzeniu e-maila. Potem 1 kredyt = 1 grafika: od 2 zł w małym pakiecie do 0,50 zł w pakiecie 200 kredytów. Opis oferty jest gratis.',
      },
      {
        q: 'Czy potrzebuję dobrego aparatu?',
        a: 'Nie. Wystarczy ostre zdjęcie z telefonu, na którym widać cały produkt. Tło i oświetlenie AI buduje od nowa.',
      },
      {
        q: 'Czy mogę sprawdzić wynik bez zakładania konta?',
        a: 'Tak – na tej stronie wygenerujesz jedną grafikę za darmo bez rejestracji. Wynik zobaczysz w przeglądarce i dostaniesz e-mailem.',
      },
    ],
    related: ['jak-wykorzystac-ai-do-miniaturek-allegro', 'jak-przygotowac-zdjecie-wejsciowe-do-ai-miniaturek-allegro', 'wymagania-techniczne-allegro-zdjecia-2025-2026'],
  },
  {
    path: '/biale-tlo-zdjecie-produktu',
    title: 'Białe tło na zdjęciu produktu – online',
    description: 'Zdjęcie produktu na białym tle online, bez Photoshopa i studia: wgraj zdjęcie z telefonu, a AI przygotuje grafikę pod zdjęcie główne Allegro. Wypróbuj za darmo.',
    h1: 'Zdjęcie produktu na białym tle',
    h1Accent: 'online, w minutę, bez studia',
    lead: 'Białe tło to standard zdjęcia głównego na Allegro i w większości sklepów internetowych. W AllGrafika robisz je online z każdego zdjęcia z telefonu – bez namiotu bezcieniowego, lampy i ręcznego wycinania tła w programie graficznym.',
    keywords: [
      'zdjęcie na białym tle aplikacja',
      'białe tło zdjęcie online',
      'jak zrobić zdjęcia na białym tle do allegro',
      'zdjęcie produktu na białym tle',
      'białe tło do zdjęć produktowych online',
    ],
    sections: [
      {
        heading: 'Białe tło online w 3 krokach',
        paragraphs: ['Nie musisz instalować aplikacji ani znać Photoshopa. Wszystko dzieje się w przeglądarce na telefonie albo komputerze.'],
        bullets: [
          'Zrób zdjęcie produktu telefonem – w dobrym świetle, z całym produktem w kadrze',
          'Wgraj je do AllGrafika i wybierz styl „Białe tło”',
          'Pobierz gotową grafikę albo opublikuj ją od razu w ofercie Allegro',
        ],
      },
      {
        heading: 'Dlaczego samo usunięcie tła to za mało',
        paragraphs: [
          'Proste narzędzia do usuwania tła wycinają produkt i wklejają go na białą planszę. Efekt często wygląda sztucznie: brak cienia, poszarpane krawędzie, produkt „wisi” w powietrzu. Kupujący przewijający listę ofert widzi to od razu.',
          'AllGrafika buduje białe tło razem ze światłem i naturalnym cieniem pod produktem, dopasowuje kadr do formatu 1:1 i zachowuje wierny wygląd produktu. Dzięki temu miniaturka wygląda jak zdjęcie ze studia, a nie jak wycinanka.',
        ],
      },
      {
        heading: 'Białe tło a wymagania Allegro',
        paragraphs: [
          'Allegro zaleca, by zdjęcie główne miało jasne, jednolite tło, a produkt zajmował większą część kadru – bez napisów, ramek i znaków wodnych. Szczegółowe wymiary i wagę plików opisujemy w osobnym poradniku o wymiarach zdjęć Allegro.',
        ],
        bullets: ['Jednolite, jasne tło bez dodatkowych elementów', 'Produkt wyraźny i w całości w kadrze', 'Bez napisów, logo sklepu i znaków wodnych na zdjęciu głównym'],
      },
    ],
    faq: [
      {
        q: 'Czy mogę zrobić zdjęcie na białym tle telefonem?',
        a: 'Tak. Zrób zwykłe zdjęcie produktu w dobrym świetle, a białe tło, cień i kadr przygotuje AI. Nie potrzebujesz namiotu bezcieniowego ani lampy.',
      },
      {
        q: 'Czy to działa jako aplikacja na telefon?',
        a: 'AllGrafika działa w przeglądarce telefonu bez instalacji. Aplikacje na Androida i iOS są w przygotowaniu – z tym samym kontem i kredytami.',
      },
      {
        q: 'Czy białe tło jest darmowe?',
        a: 'Pierwsze 5 grafik po potwierdzeniu e-maila jest za darmo, a jedną grafikę możesz sprawdzić bez konta na tej stronie. Potem 1 grafika kosztuje od 0,50 zł do 2 zł zależnie od pakietu.',
      },
      {
        q: 'Czy produkt na zdjęciu się zmieni?',
        a: 'Nie powinien – AI zmienia tło, światło i cień, a kształt, kolory i napisy produktu są chronione. Zawsze porównaj wynik z oryginałem przed publikacją oferty.',
      },
    ],
    related: ['biale-tlo-diy-vs-ai-w-fotografii-produktowej', 'wymiary-zdjec-allegro-rozmiary-piksele-waga-bledy', 'zdjecie-produktu-w-folii-i-opakowaniu-allegro'],
  },
]

export function findSeoPage(path: string): SeoPage | undefined {
  return seoPages.find((p) => p.path === path)
}
