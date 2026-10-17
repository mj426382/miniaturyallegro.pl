/**
 * SEO landing pages for tool-intent queries (spec 10, AC-SEO-007). Since 2026-10-17 the product targets sellers on
 * OLX, Vinted, eBay, Amazon and own online shops (no marketplace integrations – export presets and descriptions only).
 * Platform rules quoted here come from the platforms' official help pages (links in the copy); re-check them when
 * bumping SEO_PAGES_UPDATED.
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
export const SEO_PAGES_UPDATED = '2026-10-17'

const PRICE_FAQ = {
  q: 'Ile kosztuje jedna grafika?',
  a: 'Pierwsze 5 grafik jest darmowych po potwierdzeniu e-maila. Potem 1 kredyt = 1 grafika: od 2 zł w małym pakiecie do 0,50 zł w pakiecie 200 kredytów. Opis oferty jest gratis.',
}

const NO_INTEGRATION_FAQ = {
  q: 'Czy AllGrafika sama publikuje zdjęcia na platformie?',
  a: 'Nie. AllGrafika nie łączy się z kontami na platformach sprzedażowych i nie prosi o żadne hasła. Pobierasz gotowe pliki i kopiujesz opis, a ogłoszenie dodajesz samodzielnie.',
}

export const seoPages: SeoPage[] = [
  {
    path: '/zdjecia-ai-do-ofert',
    title: 'Zdjęcia AI do ofert – generator zdjęć',
    description: 'Generator zdjęć produktowych AI: zdjęcie z telefonu zamieniasz w grafikę na białym tle lub w aranżacji, z eksportem pod sklep i marketplace. 5 grafik gratis.',
    h1: 'Zdjęcia AI do ofert',
    h1Accent: 'z jednego zdjęcia z telefonu',
    lead: 'AllGrafika to generator zdjęć produktowych AI dla sprzedawców internetowych. Wgrywasz zwykłe zdjęcie produktu, a w kilka minut dostajesz grafiki na białym tle, w aranżacji wnętrza, w stylu sezonowym albo z produktem w użyciu – z presetem eksportu pod własny sklep, eBay, Amazon, OLX lub Vinted.',
    keywords: ['zdjęcia ai do ofert', 'generator zdjęć produktowych ai', 'zdjęcia produktowe ai', 'grafika produktowa ai'],
    sections: [
      {
        heading: 'Jak działa generator zdjęć produktowych AI',
        paragraphs: [
          'Zaczynasz od zdjęcia zrobionego telefonem – na biurku, w folii albo na podłodze. AI rozpoznaje produkt, oddziela go od tła i buduje wokół niego nową scenę: czyste białe tło pod zdjęcie główne albo aranżację, która pokazuje produkt w kontekście.',
          'Kształt, kolory, napisy i logo produktu są chronione regułami integralności – zmienia się tło, światło i scena, a nie to, co kupujący dostanie w paczce. Dlatego grafiki nadają się do ofert, a nie tylko do inspiracji.',
        ],
        bullets: [
          'Białe tło pod zdjęcie główne w sklepie i na marketplace',
          '19 stylów: uniwersalne, sezonowe (święta, Black Friday) i branżowe',
          'Własna scena opisana po polsku, także na podstawie zdjęcia referencyjnego',
          'Presety eksportu: OLX, Vinted, eBay, Amazon i własny sklep',
          'Tytuł i opis oferty dopasowany do platformy – gratis do każdego zdjęcia z grafiką',
        ],
      },
      {
        heading: 'Zdjęcia AI a zasady platform sprzedażowych',
        paragraphs: [
          'Każda platforma ma własne zasady zdjęć. Amazon wymaga czystego białego tła na zdjęciu głównym, eBay zabrania dodawania ramek, napisów i znaków wodnych, a Vinted wymaga zdjęć zrobionych przez sprzedawcę i nie dopuszcza edycji zdjęć. Grafiki z AI wykorzystuj więc tam, gdzie zasady na to pozwalają – przede wszystkim we własnym sklepie i jako zdjęcia nowych produktów.',
          'Niezależnie od platformy grafika musi przedstawiać prawdziwy produkt dokładnie taki, jaki kupujący dostanie. Przed publikacją porównaj wynik z oryginałem (w aplikacji masz podgląd obok siebie) i sprawdź aktualny regulamin miejsca, w którym sprzedajesz.',
        ],
      },
      {
        heading: 'Dla kogo są zdjęcia AI',
        paragraphs: [
          'Dla sprzedawców, którzy wystawiają wiele produktów i nie mają czasu ani budżetu na sesję zdjęciową dla każdego z nich. Masowe przesyłanie obsłuży całą dostawę naraz, a grafiki pobierzesz pojedynczo albo w paczce ZIP i wstawisz do ofert samodzielnie.',
        ],
        bullets: ['Sklepy internetowe z dziesiątkami i setkami SKU', 'Sprzedawcy nowych produktów na eBay i Amazon', 'Sprzedawcy produktów sezonowych'],
      },
    ],
    faq: [
      {
        q: 'Czy zdjęcia AI można wstawiać do ofert?',
        a: 'Tak, jeśli przedstawiają prawdziwy produkt bez zmian w jego wyglądzie i spełniają zasady danej platformy. AllGrafika zmienia tło i scenę, a chroni kształt, kolory i logo produktu. Na Vinted obowiązują własne zdjęcia bez edycji.',
      },
      PRICE_FAQ,
      {
        q: 'Czy potrzebuję dobrego aparatu?',
        a: 'Nie. Wystarczy ostre zdjęcie z telefonu, na którym widać cały produkt. Tło i oświetlenie AI buduje od nowa.',
      },
      {
        q: 'Czy mogę sprawdzić wynik bez zakładania konta?',
        a: 'Tak – na tej stronie wygenerujesz jedną grafikę za darmo bez rejestracji. Wynik zobaczysz w przeglądarce i dostaniesz e-mailem.',
      },
      NO_INTEGRATION_FAQ,
    ],
    related: ['jak-wykorzystac-ai-do-zdjec-produktowych', 'jak-przygotowac-zdjecie-do-generatora-ai', 'wymiary-zdjec-olx-vinted-ebay-amazon'],
  },
  {
    path: '/biale-tlo-zdjecie-produktu',
    title: 'Białe tło na zdjęciu produktu – online',
    description: 'Zdjęcie produktu na białym tle online, bez Photoshopa i studia: wgraj zdjęcie z telefonu, a AI przygotuje packshot pod zdjęcie główne oferty. Wypróbuj za darmo.',
    h1: 'Zdjęcie produktu na białym tle',
    h1Accent: 'online, w minutę, bez studia',
    lead: 'Białe tło to standard zdjęcia głównego w większości sklepów internetowych, a na Amazon wymóg dla zdjęcia głównego. W AllGrafika robisz je online z każdego zdjęcia z telefonu – bez namiotu bezcieniowego, lampy i ręcznego wycinania tła w programie graficznym.',
    keywords: ['zdjęcie na białym tle aplikacja', 'białe tło zdjęcie online', 'jak zrobić zdjęcie produktu na białym tle', 'zdjęcie produktu na białym tle', 'białe tło do zdjęć produktowych online'],
    sections: [
      {
        heading: 'Białe tło online w 3 krokach',
        paragraphs: ['Nie musisz instalować aplikacji ani znać Photoshopa. Wszystko dzieje się w przeglądarce na telefonie albo komputerze.'],
        bullets: [
          'Zrób zdjęcie produktu telefonem – w dobrym świetle, z całym produktem w kadrze',
          'Wgraj je do AllGrafika i wybierz styl „Białe tło”',
          'Pobierz gotową grafikę z presetem pod sklep, Amazon, eBay lub OLX',
        ],
      },
      {
        heading: 'Dlaczego samo usunięcie tła to za mało',
        paragraphs: [
          'Proste narzędzia do usuwania tła wycinają produkt i wklejają go na białą planszę. Efekt często wygląda sztucznie: brak cienia, poszarpane krawędzie, produkt „wisi” w powietrzu. Kupujący przewijający listę ofert widzi to od razu.',
          'AllGrafika buduje białe tło razem ze światłem i naturalnym cieniem pod produktem, dopasowuje kadr do formatu i zachowuje wierny wygląd produktu. Dzięki temu zdjęcie wygląda jak ze studia, a nie jak wycinanka.',
        ],
      },
      {
        heading: 'Białe tło a wymagania platform',
        paragraphs: [
          'Według wytycznych Amazon dla sprzedawców zdjęcie główne ma mieć czyste białe tło (RGB 255, 255, 255), a produkt zajmować co najmniej 85% kadru – bez dodatkowych napisów, grafik i znaków wodnych. eBay nie wymaga białego tła, ale zabrania ramek, napisów i znaków wodnych na zdjęciach. Szczegółowe wymiary i limity plików opisujemy w poradniku o wymiarach zdjęć.',
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
    related: ['biale-tlo-diy-vs-ai-w-fotografii-produktowej', 'wymiary-zdjec-olx-vinted-ebay-amazon', 'zdjecie-produktu-w-folii-i-opakowaniu'],
  },
  {
    path: '/zdjecia-produktowe-olx',
    title: 'Zdjęcia do ogłoszeń OLX – jak je zrobić',
    description: 'Zdjęcia do ogłoszeń OLX: jak sfotografować przedmiot telefonem, co pokazać i czego unikać, plus preset eksportu i opis ogłoszenia pod OLX w AllGrafika.',
    h1: 'Zdjęcia do ogłoszeń OLX',
    h1Accent: 'wyraźne, uczciwe i gotowe w minutę',
    lead: 'Na OLX kupujący ocenia przedmiot po kilku zdjęciach z listy ogłoszeń. AllGrafika pomaga przygotować je z Twojego zdjęcia z telefonu: wyprostujesz i wykadrujesz kadr presetem pod OLX, poprawisz jasność, a dla nowych produktów zrobisz czyste zdjęcie na białym tle. Do tego krótki opis ogłoszenia do skopiowania.',
    keywords: ['zdjęcia do ogłoszeń olx', 'zdjęcia na olx', 'zdjęcia produktowe olx'],
    sections: [
      {
        heading: 'Jakie zdjęcia działają na OLX',
        paragraphs: [
          'Pomoc OLX wskazuje, że zdjęcia mają przedstawiać wyłącznie oferowany przedmiot, nie mogą pochodzić z internetu ani zawierać danych kontaktowych, takich jak numer telefonu. Starszy artykuł pomocy OLX podaje limit 8 zdjęć i 5 MB na plik w formatach JPG i PNG – aktualne wartości sprawdź w formularzu dodawania ogłoszenia.',
          'Przy rzeczach używanych najważniejsza jest uczciwość: pokaż przedmiot w całości, z kilku stron i z ewentualnymi śladami użytkowania. Takie zdjęcia ograniczają pytania i nieporozumienia przy odbiorze.',
        ],
        bullets: ['Pierwsze zdjęcie: cały przedmiot, ostro i w dobrym świetle', 'Kolejne: detale, metki, numery seryjne, wady', 'Bez numeru telefonu, napisów i zdjęć z internetu'],
      },
      {
        heading: 'Co robi AllGrafika przy ogłoszeniu na OLX',
        paragraphs: [
          'Preset eksportu pod OLX ustawia kadr i rozmiar pliku, a narzędzia kadrowania, obrotu i korekty jasności poprawiają zdjęcie z telefonu bez zmiany samego przedmiotu. Dla nowych produktów możesz wygenerować packshot na białym tle albo aranżację – zawsze z produktem wiernym oryginałowi.',
          'Opis ogłoszenia dopasowany do OLX dostajesz gratis do każdego zdjęcia z gotową grafiką: krótki tytuł z najważniejszą frazą, stan, parametry i informacje o odbiorze. Weryfikujesz go i wklejasz do formularza OLX samodzielnie.',
        ],
      },
    ],
    faq: [
      {
        q: 'Czy na OLX można wstawić zdjęcie na białym tle z AI?',
        a: 'Zdjęcie musi przedstawiać oferowany przedmiot. Przy nowych produktach packshot z Twojego zdjęcia pokazuje ten sam produkt bez zmian w wyglądzie. Przy rzeczach używanych dodaj też zwykłe zdjęcia aktualnego stanu.',
      },
      PRICE_FAQ,
      NO_INTEGRATION_FAQ,
    ],
    related: ['wymiary-zdjec-olx-vinted-ebay-amazon', 'jak-napisac-tytul-ogloszenia-olx-vinted-ebay', 'zdjecia-produktow-telefonem-poradnik'],
  },
  {
    path: '/zdjecia-produktowe-vinted',
    title: 'Zdjęcia na Vinted – zasady i wskazówki',
    description: 'Zdjęcia na Vinted: co mówią zasady katalogu (własne zdjęcia, bez edycji i znaków wodnych), jak zrobić je telefonem i jak AllGrafika pomaga w opisie i kadrze.',
    h1: 'Zdjęcia na Vinted',
    h1Accent: 'zgodne z zasadami katalogu',
    lead: 'Vinted ma wyjątkowo ścisłe zasady zdjęć: mają być zrobione przez Ciebie i przedstawiać przedmiot takim, jaki jest. Dlatego na Vinted nie wstawiaj scen ani teł wygenerowanych przez AI. AllGrafika przyda się tu inaczej – do przygotowania kadru Twojego zdjęcia pod Vinted i do opisu ogłoszenia.',
    keywords: ['zdjęcia na vinted', 'zdjęcia produktowe vinted', 'zdjęcia vinted zasady'],
    sections: [
      {
        heading: 'Co mówią zasady katalogu Vinted',
        paragraphs: [
          'Zasady katalogu Vinted wymagają, by zdjęcia były ostre, zrobione przez sprzedawcę z myślą o Vinted i przedstawiały przedmiot takim, jaki jest – bez edycji obrazu. Nie można zastępować ich zdjęciami stockowymi, zdjęciami z reklam ani zdjęciami ze znakiem wodnym. Pierwsze zdjęcie powinno pokazywać cały przedmiot, a do ogłoszenia możesz dodać do 20 zdjęć.',
          'Poradnik Vinted zaleca jednolite, neutralne tło, światło dzienne bez lampy błyskowej i filtrów oraz unikanie kolaży. Przy markowych rzeczach warto pokazać metki i detale potwierdzające autentyczność.',
        ],
        bullets: [
          'Własne zdjęcia przedmiotu, bez edycji i filtrów',
          'Cały przedmiot na pierwszym zdjęciu',
          'Wady i ślady użytkowania pokazane wprost',
          'Bez zdjęć z internetu, stockowych i znaków wodnych',
        ],
      },
      {
        heading: 'Jak AllGrafika pomaga przy Vinted',
        paragraphs: [
          'Na Vinted używaj zdjęć prosto z telefonu. W AllGrafika możesz pobrać je z presetem eksportu pod Vinted, który dopasowuje kadr i rozmiar pliku, oraz dostać opis ogłoszenia dopasowany do Vinted: rozmiar, marka, materiał, stan i wymiary w czytelnej kolejności. Style AI ze scenami i nowym tłem zostaw na sklep internetowy i inne platformy, które je dopuszczają.',
        ],
      },
    ],
    faq: [
      {
        q: 'Czy mogę wstawić na Vinted zdjęcie wygenerowane przez AI?',
        a: 'Nie polecamy tego. Zasady katalogu Vinted wymagają własnych zdjęć przedmiotu bez edycji obrazu, więc scena albo tło z AI mogą zostać uznane za naruszenie. Wstaw zwykłe zdjęcia z telefonu.',
      },
      {
        q: 'Ile zdjęć można dodać na Vinted?',
        a: 'Według zasad katalogu Vinted do jednego ogłoszenia dodasz do 20 zdjęć. Pierwsze powinno pokazywać cały przedmiot, kolejne detale, metki i ewentualne wady.',
      },
      PRICE_FAQ,
      NO_INTEGRATION_FAQ,
    ],
    related: ['zdjecia-produktow-telefonem-poradnik', 'jak-budowac-zaufanie-kupujacych-zdjeciami', 'jak-napisac-tytul-ogloszenia-olx-vinted-ebay'],
  },
  {
    path: '/zdjecia-produktowe-ebay',
    title: 'Zdjęcia na eBay – wymagania i generator',
    description: 'Zdjęcia produktów na eBay: wymagania (min. 500 px, do 24 zdjęć, bez ramek i napisów), jak je przygotować z telefonu i jak zrobić packshot z AI w AllGrafika.',
    h1: 'Zdjęcia produktów na eBay',
    h1Accent: 'zgodne z zasadami zdjęć eBay',
    lead: 'eBay pozwala dodać do 24 zdjęć do oferty i ma jasną politykę zdjęć: bez ramek, napisów i znaków wodnych, z produktem pokazanym zgodnie z rzeczywistością. W AllGrafika przygotujesz z jednego zdjęcia z telefonu czysty packshot nowego produktu i dodatkowe ujęcia, a preset eksportu pod eBay ustawi rozmiar pliku.',
    keywords: ['zdjęcia na ebay', 'zdjęcia produktów ebay', 'wymagania zdjęć ebay'],
    sections: [
      {
        heading: 'Wymagania eBay dla zdjęć',
        paragraphs: [
          'Według pomocy eBay zdjęcie musi mieć co najmniej 500 px na dłuższym boku, a zalecane jest około 1600 px. Plik może mieć do 12 MB i być w formacie m.in. JPEG, PNG, WEBP lub HEIC; najlepiej wyglądają proporcje 1:1 albo 16:9.',
          'Polityka zdjęć eBay zabrania dodawania ramek, tekstu, grafik marketingowych i znaków wodnych, a przy przedmiotach używanych, uszkodzonych lub wadliwych nie można używać zdjęć stockowych. Zdjęcia muszą dokładnie przedstawiać przedmiot.',
        ],
        bullets: [
          'Min. 500 px na dłuższym boku, zalecane ok. 1600 px',
          'Do 24 zdjęć, pierwsze jest zdjęciem głównym',
          'Bez ramek, napisów i znaków wodnych',
          'Przedmioty używane: tylko prawdziwe zdjęcia egzemplarza',
        ],
      },
      {
        heading: 'Jak AllGrafika pomaga przy ofercie na eBay',
        paragraphs: [
          'Dla nowych produktów generujesz packshot na białym tle i ujęcia w aranżacji, w których produkt pozostaje wierny oryginałowi. Preset eksportu pod eBay ustawia kadr i rozmiar pliku; plakietek promocyjnych i infografik z napisami nie dodawaj do zdjęć na eBay, bo polityka zdjęć ich nie dopuszcza. Opis i tytuł oferty dopasowane do eBay kopiujesz do formularza samodzielnie.',
        ],
      },
    ],
    faq: [
      {
        q: 'Czy na zdjęciu na eBay mogę dodać napis „-20%”?',
        a: 'Nie. Polityka zdjęć eBay zabrania dodawania tekstu, ramek i materiałów marketingowych do zdjęć. Promocję opisz w tytule lub opisie oferty.',
      },
      PRICE_FAQ,
      NO_INTEGRATION_FAQ,
    ],
    related: ['wymiary-zdjec-olx-vinted-ebay-amazon', 'zdjecie-glowne-oferty-wymagania-platform', 'jak-napisac-tytul-ogloszenia-olx-vinted-ebay'],
  },
  {
    path: '/zdjecia-produktowe-amazon',
    title: 'Zdjęcia na Amazon – białe tło i wymagania',
    description: 'Zdjęcia produktów na Amazon: zdjęcie główne na czystym białym tle, produkt na 85% kadru, bez napisów. Zrób packshot z telefonu w AllGrafika. 5 grafik gratis.',
    h1: 'Zdjęcia produktów na Amazon',
    h1Accent: 'białe tło na zdjęciu głównym',
    lead: 'Na Amazon zdjęcie główne ma ścisłe wymagania: czyste białe tło, produkt wypełniający większość kadru i żadnych dodatkowych napisów. AllGrafika przygotuje taki packshot z jednego zdjęcia z telefonu, a na kolejne zdjęcia dorobisz aranżacje i infografiki z cechami produktu.',
    keywords: ['zdjęcia na amazon', 'zdjęcia produktów amazon', 'amazon białe tło zdjęcie główne'],
    sections: [
      {
        heading: 'Wymagania Amazon dla zdjęcia głównego',
        paragraphs: [
          'Według wytycznych Amazon dla sprzedawców zdjęcie główne powinno mieć czyste białe tło (RGB 255, 255, 255), produkt ma wypełniać co najmniej 85% kadru, a na zdjęciu nie może być dodatkowego tekstu, grafik ani znaków wodnych. Amazon preferuje zdjęcia większe niż 1000 px na dłuższym boku, bo umożliwiają powiększanie.',
          'Pełne, aktualne wymagania znajdziesz w Seller Central na stronie o wymaganiach dla zdjęć produktów – sprawdź je przed publikacją, bo różnią się też między kategoriami.',
        ],
        bullets: [
          'Czyste białe tło na zdjęciu głównym',
          'Produkt na co najmniej 85% kadru',
          'Bez tekstu, grafik i znaków wodnych na zdjęciu głównym',
          'Ponad 1000 px na dłuższym boku dla powiększenia',
        ],
      },
      {
        heading: 'Zdjęcie główne i dodatkowe w AllGrafika',
        paragraphs: [
          'Styl „Białe tło” tworzy packshot z naturalnym cieniem, a preset eksportu pod Amazon ustawia kadr i rozmiar pliku. Na zdjęcia dodatkowe możesz wygenerować produkt w użyciu, aranżację wnętrza albo infografikę z wymiarami – produkt na każdej grafice zostaje wierny oryginałowi. Tytuł i opis oferty dostajesz do skopiowania.',
        ],
      },
    ],
    faq: [
      {
        q: 'Czy zdjęcie z AI spełni wymagania Amazon?',
        a: 'Styl „Białe tło” przygotowuje zdjęcie na czystym białym tle bez napisów, jak wymaga Amazon dla zdjęcia głównego. Przed publikacją sprawdź wynik z oryginałem i z aktualnymi wymaganiami w Seller Central.',
      },
      PRICE_FAQ,
      NO_INTEGRATION_FAQ,
    ],
    related: ['zdjecie-glowne-oferty-wymagania-platform', 'wymiary-zdjec-olx-vinted-ebay-amazon', 'biale-tlo-diy-vs-ai-w-fotografii-produktowej'],
  },
]

export function findSeoPage(path: string): SeoPage | undefined {
  return seoPages.find((p) => p.path === path)
}
