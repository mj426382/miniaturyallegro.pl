import type { SeoContent } from '../seoContentLoader'
import { PRICE_FAQ, SRC } from '../seoShared'

const content: SeoContent = {
  lead: 'Packshot to zdjęcie samego produktu na jednolitym, najczęściej białym tle – bez rekwizytów, z równym światłem i wiernym kolorem. To standard zdjęcia głównego w sklepach internetowych, a na Amazonie wymóg dla zdjęcia głównego. W AllGrafika zrobisz packshot online z jednego zdjęcia z telefonu: AI buduje tło, światło i naturalny cień, a produkt zostaje taki, jak na Twoim zdjęciu.',
  sections: [
    {
      heading: 'Packshot – co to jest',
      paragraphs: [
        'Nazwa pochodzi z angielskiego „pack shot”, czyli ujęcie opakowania. W e-commerce oznacza zdjęcie produktu (z opakowaniem albo bez) na neutralnym tle, które pokazuje kształt, kolor i proporcje bez rozpraszaczy. Kupujący porównuje na nim produkty jeden do jednego – dlatego packshoty dominują na listach produktów i w wynikach wyszukiwania sklepów.',
        'Przeciwieństwem packshotu jest zdjęcie lifestyle: produkt w scenie, we wnętrzu albo w użyciu. Oba typy się uzupełniają – packshot otwiera galerię, a sceny pomagają wyobrazić sobie posiadanie rzeczy. Kiedy który wygrywa, opisujemy w poradniku [białe tło czy lifestyle](/blog/biale-tlo-vs-lifestyle-jaki-styl-zdjecia-produktu).',
      ],
    },
    {
      heading: 'Cechy dobrego packshotu',
      paragraphs: ['Dobry packshot wygląda „nudno” w najlepszym sensie: nic nie odciąga uwagi od produktu.'],
      bullets: [
        'Jednolite tło – białe albo bardzo jasne, bez cieni na ścianie i fałd materiału',
        'Produkt wypełnia większość kadru z podobnym marginesem z każdej strony',
        'Ostrość na całym produkcie, od przedniej krawędzi po tył',
        'Wierny kolor – bez przebarwień od żółtego światła lampy',
        'Delikatny cień pod produktem, dzięki któremu przedmiot nie „wisi” w powietrzu',
        'Bez napisów, logo sklepu, ramek i znaków wodnych',
        'Ta sama proporcja (najczęściej 1:1) dla całego katalogu',
      ],
    },
    {
      heading: 'Rodzaje ujęć packshotowych',
      paragraphs: ['Jeden produkt to zwykle kilka packshotów. Typowy zestaw:'],
      table: {
        caption: 'Ujęcia packshotowe i ich zastosowanie',
        head: ['Ujęcie', 'Co pokazuje', 'Gdzie w galerii'],
        rows: [
          ['Front (na wprost)', 'Rozpoznawalną sylwetkę produktu', 'Zdjęcie główne'],
          ['Trzy czwarte (3/4)', 'Bryłę i głębokość', 'Zdjęcie główne lub drugie'],
          ['Bok, tył, spód', 'Złącza, etykiety, podeszwę, zapięcia', 'Kolejne zdjęcia'],
          ['Detal (zbliżenie)', 'Materiał, szwy, fakturę, wykończenie', 'Kolejne zdjęcia'],
          ['Zestaw', 'Zawartość opakowania i akcesoria', 'Przed zdjęciami w użyciu'],
          ['Z opakowaniem', 'Pudełko – ważne przy prezentach i kosmetykach', 'Ostatnie zdjęcia'],
          ['Flat lay i ghost mannequin', 'Odzież ułożoną płasko lub „na niewidzialnym manekinie”', 'Moda – zdjęcie główne'],
        ],
      },
    },
    {
      heading: 'Jak zrobić packshot – trzy sposoby',
      paragraphs: [
        'Studio: namiot bezcieniowy, dwie lub trzy lampy, statyw i obróbka – efekt najlepszy, ale według cennika KB.pl z 2026 roku packshot kosztuje średnio 58,29 zł brutto za ujęcie (typowo 50,76–72,21 zł).',
        'Samodzielnie: brystol lub namiot z kartonu, światło dzienne albo lampy LED i ręczne wycinanie tła. Tanio, ale czystą biel i równy cień trudno uzyskać bez wprawy – sprawdź poradnik [oświetlenie do zdjęć produktowych](/blog/oswietlenie-diy-do-zdjec-produktowych).',
        'Online z AI: robisz jedno zdjęcie telefonem, a [generator zdjęć produktowych](/zdjecia-ai-do-ofert) tworzy packshot w stylu „Białe tło” – z naturalnym cieniem i kadrem dopasowanym do formatu, w kilka minut i za kilka złotych.',
      ],
    },
    {
      heading: 'Packshot online z AI – krok po kroku',
      paragraphs: ['Tak powstaje packshot w AllGrafika:'],
      steps: [
        'Sfotografuj cały produkt telefonem w rozproszonym świetle – tło może być dowolne.',
        'Wgraj zdjęcie i wybierz styl „Białe tło” (jest w zestawie startowym).',
        'Porównaj grafikę z oryginałem: kształt, kolor, napisy i logo muszą się zgadzać.',
        'Wybierz preset eksportu (np. Amazon ustawi produkt na 85% kadru na czystej bieli) i pobierz plik.',
      ],
    },
    {
      heading: 'Packshot a wymagania platform',
      paragraphs: [
        'Według wytycznych Amazon zdjęcie główne musi mieć czyste białe tło (RGB 255, 255, 255), a produkt zajmować co najmniej 85% kadru – więcej na stronie [zdjęcia na Amazon](/zdjecia-produktowe-amazon). eBay nie wymaga białego tła, ale zabrania ramek, napisów i znaków wodnych. Google Merchant Center nie przyjmuje zdjęć z dodanym tekstem promocyjnym, znakami wodnymi i ramkami.',
        'Na Vinted packshot z AI się nie sprawdzi – zasady katalogu wymagają własnych zdjęć przedmiotu bez edycji. Szczegółowe porównanie wymagań zdjęcia głównego znajdziesz w poradniku [zdjęcie główne oferty](/blog/zdjecie-glowne-oferty-wymagania-platform).',
      ],
    },
  ],
  faq: [
    {
      q: 'Packshot – co to znaczy?',
      a: 'Packshot to zdjęcie samego produktu na jednolitym, zwykle białym tle, bez rekwizytów i napisów. Służy do pokazania kształtu, koloru i proporcji produktu w sklepie internetowym i na marketplace.',
    },
    {
      q: 'Czy packshot musi być na białym tle?',
      a: 'Nie zawsze. Najczęściej jest biały, bywa też jasnoszary lub w kolorze marki. Biel jest jednak wymagana na zdjęciu głównym na Amazonie i najbezpieczniejsza w większości sklepów.',
    },
    {
      q: 'Czym różni się packshot od zdjęcia lifestyle?',
      a: 'Packshot pokazuje sam produkt na neutralnym tle, a zdjęcie lifestyle – produkt w scenie lub w użyciu. Packshot ułatwia porównanie, lifestyle pomaga wyobrazić sobie posiadanie rzeczy.',
    },
    {
      q: 'Ile kosztuje packshot?',
      a: 'W studiu średnio ok. 58 zł brutto za ujęcie według cennika KB.pl z 2026 roku. Packshot z AI w AllGrafika kosztuje od 0,50 do 2 zł za grafikę, a pierwsze 5 grafik jest gratis.',
    },
    PRICE_FAQ,
  ],
  sources: [SRC.amazon, SRC.ebayPolicy, SRC.merchant, SRC.vintedRules, SRC.kbPackshot],
}

export default content
