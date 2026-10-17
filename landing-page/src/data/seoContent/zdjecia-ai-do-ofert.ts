import type { SeoContent } from '../seoContentLoader'
import { NO_INTEGRATION_FAQ, PRICE_FAQ, SRC } from '../seoShared'

const content: SeoContent = {
  lead: 'AllGrafika to generator zdjęć produktowych AI dla sklepów internetowych i sprzedawców na marketplace’ach. Wgrywasz zwykłe zdjęcie produktu z telefonu, wybierasz style, a po kilku minutach pobierasz gotowe grafiki: packshot na białym tle, aranżację wnętrza, ciemny luksus, scenę sezonową albo produkt w użyciu – z presetem eksportu pod własny sklep, eBay, Amazon lub OLX i z opisem oferty do skopiowania.',
  sections: [
    {
      heading: 'Jak działa generator zdjęć produktowych AI',
      paragraphs: [
        'Zaczynasz od zdjęcia zrobionego telefonem – na biurku, w folii albo na podłodze. AI rozpoznaje produkt, oddziela go od tła i buduje wokół niego nową scenę: czyste białe tło pod zdjęcie główne albo aranżację, która pokazuje produkt w kontekście użycia.',
        'Kształt, kolory, napisy i logo produktu są chronione regułami integralności – zmienia się tło, światło i scena, a nie to, co kupujący dostanie w paczce. Dlatego grafiki nadają się do ofert, a nie tylko do inspiracji. Wynik zawsze porównasz z oryginałem w podglądzie obok siebie.',
      ],
      bullets: [
        'Białe tło pod zdjęcie główne w sklepie i na marketplace',
        '19 stylów: uniwersalne, sezonowe (święta, Black Friday) i branżowe',
        'Własna scena opisana po polsku, także na podstawie zdjęcia referencyjnego',
        'Presety eksportu: sklep internetowy, OLX, Vinted, eBay i Amazon',
        'Tytuł i opis oferty dopasowany do platformy – gratis do każdego zdjęcia z grafiką',
      ],
    },
    {
      heading: 'Od zdjęcia z telefonu do grafiki w ofercie – krok po kroku',
      paragraphs: ['Cały proces odbywa się w przeglądarce na komputerze albo w telefonie, bez instalowania programu graficznego.'],
      steps: [
        'Zrób ostre zdjęcie całego produktu w dobrym świetle – wskazówki znajdziesz w poradniku [jak przygotować zdjęcie do generatora AI](/blog/jak-przygotowac-zdjecie-do-generatora-ai).',
        'Wgraj je do AllGrafika (JPG, PNG lub WebP do 10 MB). Przy większej dostawie prześlij do 50 zdjęć naraz.',
        'Uruchom zestaw startowy: białe tło, wnętrze i ciemny luksus – 3 grafiki za 3 kredyty.',
        'Dogeneruj kolejne style, opisz własną scenę po polsku albo poproś o poprawkę gotowej grafiki („jaśniejsze tło”, „bez cienia”).',
        'Wykadruj, obróć i popraw jasność, wybierz preset platformy i pobierz pliki pojedynczo lub w paczce ZIP.',
        'Skopiuj tytuł i opis oferty dopasowany do platformy i wstaw wszystko do ogłoszenia lub karty produktu.',
      ],
    },
    {
      heading: 'Style w generatorze i ich miejsce w ofercie',
      paragraphs: ['Różne style pełnią różne role w galerii. Najczęściej zdjęcie główne to packshot, a sceny i infografiki trafiają na kolejne pozycje.'],
      table: {
        caption: 'Style AllGrafika i typowe zastosowanie',
        head: ['Styl', 'Do czego służy', 'Na co uważać'],
        rows: [
          ['Białe tło', 'Zdjęcie główne w sklepie, na Amazonie i eBayu – [packshot](/packshot-online)', 'Na Amazonie zdjęcie główne musi mieć czystą biel i produkt na co najmniej 85% kadru'],
          ['Lifestyle – wnętrze', 'Galeria i media społecznościowe: produkt w kontekście', 'Rekwizyty nie mogą sugerować, że są w zestawie'],
          ['Ciemny luksus i gradient', 'Produkty premium, kosmetyki, elektronika', 'Nie na zdjęcie główne Amazon'],
          ['Produkt w użyciu', 'Pokazanie skali i zastosowania', 'Scena musi odpowiadać prawdziwemu przeznaczeniu produktu'],
          ['Sezonowe (5) i branżowe (8)', 'Kampanie: święta, Black Friday, Walentynki, Wielkanoc, lato', 'Wymieniaj je po sezonie'],
          ['Infografiki (gratis)', 'Cechy z ikonami albo wymiary na zdjęciu dodatkowym', 'eBay i zdjęcie główne Amazon nie dopuszczają napisów'],
        ],
      },
    },
    {
      heading: 'Zdjęcia AI a zasady platform sprzedażowych',
      paragraphs: [
        'Każda platforma ma własne zasady zdjęć. Amazon wymaga czystego białego tła na zdjęciu głównym, eBay zabrania dodawania ramek, napisów i znaków wodnych, a Vinted wymaga zdjęć zrobionych przez sprzedawcę i nie dopuszcza edycji zdjęć. Grafiki z AI wykorzystuj więc tam, gdzie zasady na to pozwalają – przede wszystkim [we własnym sklepie internetowym](/zdjecia-produktowe-do-sklepu-internetowego), na [Amazonie](/zdjecia-produktowe-amazon) i [eBayu](/zdjecia-produktowe-ebay) przy nowych produktach.',
        'Niezależnie od platformy grafika musi przedstawiać prawdziwy produkt dokładnie taki, jaki kupujący dostanie. Przed publikacją porównaj wynik z oryginałem i sprawdź aktualny regulamin miejsca, w którym sprzedajesz. Szerzej piszemy o tym w poradniku [gdzie zdjęcia AI mają sens](/blog/jak-wykorzystac-ai-do-zdjec-produktowych).',
      ],
    },
    {
      heading: 'Dla kogo jest generator',
      paragraphs: [
        'Dla sprzedawców, którzy wystawiają wiele produktów i nie mają czasu ani budżetu na sesję zdjęciową dla każdego z nich. Porównanie z sesją w studiu znajdziesz na stronie [fotografia produktowa AI](/fotografia-produktowa-ai).',
      ],
      bullets: [
        'Sklepy internetowe z dziesiątkami i setkami SKU',
        'Sprzedawcy nowych produktów na eBay i Amazon',
        'Sprzedawcy produktów sezonowych i kampanii promocyjnych',
        'Twórcy rękodzieła i małe marki bez własnego studia',
      ],
    },
  ],
  faq: [
    {
      q: 'Czy zdjęcia z generatora AI można wstawiać do ofert?',
      a: 'Tak, jeśli przedstawiają prawdziwy produkt bez zmian w jego wyglądzie i spełniają zasady danej platformy. AllGrafika zmienia tło i scenę, a chroni kształt, kolory i logo produktu. Na Vinted obowiązują własne zdjęcia bez edycji, więc tam grafik AI nie używaj.',
    },
    PRICE_FAQ,
    {
      q: 'Czy potrzebuję dobrego aparatu?',
      a: 'Nie. Wystarczy ostre zdjęcie z telefonu, na którym widać cały produkt. Tło i oświetlenie AI buduje od nowa, ale im lepsze zdjęcie wejściowe, tym wierniejsze detale na grafice.',
    },
    {
      q: 'Jak długo trwa generowanie?',
      a: 'Zestaw startowy jest zwykle gotowy w ciągu 1–3 minut. Generowanie działa w tle, więc w tym czasie możesz przesyłać kolejne zdjęcia.',
    },
    {
      q: 'Czy mogę sprawdzić wynik bez zakładania konta?',
      a: 'Tak – na tej stronie wygenerujesz jedną grafikę za darmo bez rejestracji. Wynik zobaczysz w przeglądarce i dostaniesz e-mailem.',
    },
    NO_INTEGRATION_FAQ,
  ],
  sources: [SRC.amazon, SRC.ebayPolicy, SRC.vintedRules],
}

export default content
