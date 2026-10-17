import type { SeoContent } from '../seoContentLoader'
import { SRC } from '../seoShared'

const content: SeoContent = {
  lead: 'Białe tło to standard zdjęcia głównego w większości sklepów internetowych, a na Amazonie wymóg dla zdjęcia głównego. W AllGrafika robisz je online z każdego zdjęcia z telefonu – bez namiotu bezcieniowego, lampy i ręcznego wycinania tła w programie graficznym. AI buduje czystą biel, światło i naturalny cień, a produkt zostaje wierny oryginałowi.',
  sections: [
    {
      heading: 'Białe tło online w 3 krokach',
      paragraphs: ['Nie musisz instalować aplikacji ani znać Photoshopa. Wszystko dzieje się w przeglądarce na telefonie albo komputerze.'],
      steps: [
        'Zrób zdjęcie produktu telefonem – w dobrym świetle, z całym produktem w kadrze. Tło może być dowolne: biurko, podłoga, kuchenny blat.',
        'Wgraj je do AllGrafika i wybierz styl „Białe tło”.',
        'Pobierz gotową grafikę z presetem pod sklep internetowy, Amazon, eBay lub OLX.',
      ],
    },
    {
      heading: 'Jak zrobić zdjęcie produktu na białym tle – porównanie metod',
      paragraphs: ['Do białego tła prowadzą trzy drogi. Różnią się sprzętem, czasem i tym, jak naturalny jest efekt.'],
      table: {
        caption: 'Metody uzyskania białego tła na zdjęciu produktu',
        head: ['Metoda', 'Czego potrzebujesz', 'Typowy efekt'],
        rows: [
          ['Biały brystol i okno', 'Arkusz brystolu, światło dzienne, blenda z kartki', 'Tło zwykle szarawe, wymaga rozjaśnienia w obróbce'],
          ['Aplikacja do usuwania tła', 'Telefon lub narzędzie online', 'Wycięty produkt bez cienia, czasem poszarpane krawędzie'],
          ['AI w AllGrafika', 'Jedno zdjęcie z telefonu', 'Czysta biel, światło i naturalny cień, kadr dopasowany do formatu'],
        ],
      },
    },
    {
      heading: 'Dlaczego samo usunięcie tła to za mało',
      paragraphs: [
        'Proste narzędzia do usuwania tła wycinają produkt i wklejają go na białą planszę. Efekt często wygląda sztucznie: brak cienia, poszarpane krawędzie, produkt „wisi” w powietrzu. Kupujący przewijający listę ofert widzi to od razu. Kiedy darmowe wycięcie tła wystarczy, opisujemy w poradniku [jak usunąć tło ze zdjęcia produktu](/blog/jak-usunac-tlo-ze-zdjecia-produktu).',
        'AllGrafika buduje białe tło razem ze światłem i naturalnym cieniem pod produktem, dopasowuje kadr do formatu i zachowuje wierny wygląd produktu. Dzięki temu zdjęcie wygląda jak [packshot ze studia](/packshot-online), a nie jak wycinanka.',
      ],
    },
    {
      heading: 'Najczęstsze błędy na zdjęciach na białym tle',
      paragraphs: ['Te problemy widać na listach produktów najczęściej – i łatwo ich uniknąć:'],
      bullets: [
        'Szare lub kremowe tło zamiast bieli – efekt niedoświetlenia albo ciepłego światła lampy',
        'Biały produkt zlewa się z tłem – potrzebny delikatny cień lub kontur, który oddzieli go od bieli',
        'Produkt za mały w kadrze – na miniaturze w wynikach wyszukiwania staje się nieczytelny',
        'Zmieniony kolor produktu po „wybielaniu” całego zdjęcia w edytorze',
        'Logo sklepu lub napis „promocja” na zdjęciu głównym – wiele platform tego zabrania',
      ],
    },
    {
      heading: 'Białe tło a wymagania platform',
      paragraphs: [
        'Według wytycznych Amazon dla sprzedawców zdjęcie główne ma mieć czyste białe tło (RGB 255, 255, 255), a produkt zajmować co najmniej 85% kadru – bez dodatkowych napisów, grafik i znaków wodnych. eBay nie wymaga białego tła, ale zabrania ramek, napisów i znaków wodnych na zdjęciach. We [własnym sklepie internetowym](/zdjecia-produktowe-do-sklepu-internetowego) białe tło nie jest obowiązkowe, ale jedno tło na wszystkich zdjęciach głównych sprawia, że katalog wygląda spójnie.',
        'Szczegółowe wymiary i limity plików na poszczególnych platformach opisujemy w poradniku [wymiary zdjęć OLX, Vinted, eBay i Amazon](/blog/wymiary-zdjec-olx-vinted-ebay-amazon).',
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
      q: 'Jak zrobić zdjęcie białego produktu na białym tle?',
      a: 'Biały produkt potrzebuje cienia albo delikatnego konturu, żeby nie zlał się z tłem. Fotografuj go w świetle bocznym, a w AllGrafika styl „Białe tło” dodaje naturalny cień pod produktem.',
    },
    {
      q: 'Czy białe tło jest darmowe?',
      a: 'Pierwsze 5 grafik po potwierdzeniu e-maila jest za darmo, a jedną grafikę możesz sprawdzić bez konta na tej stronie. Potem 1 grafika kosztuje od 0,50 zł do 2 zł zależnie od pakietu, a w abonamencie Pro 0,39 zł.',
    },
    {
      q: 'Czy produkt na zdjęciu się zmieni?',
      a: 'Nie powinien – AI zmienia tło, światło i cień, a kształt, kolory i napisy produktu są chronione. Zawsze porównaj wynik z oryginałem przed publikacją oferty.',
    },
  ],
  sources: [SRC.amazon, SRC.ebayPolicy],
}

export default content
