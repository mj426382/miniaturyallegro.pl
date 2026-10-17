import type { SeoContent } from '../seoContentLoader'
import { NO_INTEGRATION_FAQ, PRICE_FAQ, SRC } from '../seoShared'

const content: SeoContent = {
  lead: 'Na Amazonie zdjęcie główne ma ścisłe wymagania: czyste białe tło, produkt wypełniający większość kadru i żadnych dodatkowych napisów. AllGrafika przygotuje taki packshot z jednego zdjęcia z telefonu, a na kolejne zdjęcia dorobisz aranżacje i infografiki z cechami produktu.',
  sections: [
    {
      heading: 'Wymagania Amazon dla zdjęcia głównego',
      paragraphs: [
        'Według wytycznych Amazon dla sprzedawców zdjęcie główne powinno mieć czyste białe tło (RGB 255, 255, 255), produkt ma wypełniać co najmniej 85% kadru, a na zdjęciu nie może być dodatkowego tekstu, grafik ani znaków wodnych. Amazon preferuje zdjęcia większe niż 1000 px na dłuższym boku, bo umożliwiają powiększanie.',
        'Pełne, aktualne wymagania znajdziesz w Seller Central na stronie o wymaganiach dla zdjęć produktów – sprawdź je przed publikacją, bo różnią się też między kategoriami.',
      ],
      bullets: ['Czyste białe tło na zdjęciu głównym', 'Produkt na co najmniej 85% kadru', 'Bez tekstu, grafik i znaków wodnych na zdjęciu głównym', 'Ponad 1000 px na dłuższym boku dla powiększenia'],
    },
    {
      heading: 'Zdjęcia dodatkowe na Amazonie',
      paragraphs: [
        'Zasady zdjęcia głównego nie dotyczą w tym samym stopniu kolejnych pozycji galerii. To miejsce na produkt w użyciu, zdjęcia ze skalą, detale i grafiki z wymiarami – zawsze z produktem zgodnym z tym, co kupujący otrzyma. Sprawdź w Seller Central, co dopuszcza Twoja kategoria.',
      ],
      table: {
        caption: 'Przykładowy zestaw zdjęć oferty na Amazonie',
        head: ['Pozycja', 'Co pokazać', 'Styl w AllGrafika'],
        rows: [
          ['Zdjęcie główne', 'Cały produkt na czystej bieli, min. 85% kadru', 'Białe tło + preset Amazon'],
          ['2–3', 'Inne kąty i detale', 'Białe tło lub wiele ujęć'],
          ['4', 'Produkt w użyciu, skala', 'Produkt w użyciu, wnętrze'],
          ['5', 'Wymiary i najważniejsze cechy', 'Infografika (gratis)'],
        ],
      },
    },
    {
      heading: 'Zdjęcie główne i dodatkowe w AllGrafika',
      paragraphs: [
        'Styl „Białe tło” tworzy packshot z naturalnym cieniem, a preset eksportu pod Amazon zapisuje kwadrat 2000 × 2000 px i – przy eksporcie całej grafiki – obcina białe marginesy tak, by produkt zajmował 85% dłuższego boku na czystej bieli. Na zdjęcia dodatkowe możesz wygenerować produkt w użyciu, aranżację wnętrza albo infografikę z wymiarami – produkt na każdej grafice zostaje wierny oryginałowi. Tytuł i opis oferty dostajesz do skopiowania.',
        'Te same packshoty wykorzystasz w [sklepie internetowym](/zdjecia-produktowe-do-sklepu-internetowego) i na [eBayu](/zdjecia-produktowe-ebay). Jak zrobić białe tło z telefonu, pokazujemy na stronie [zdjęcie produktu na białym tle](/biale-tlo-zdjecie-produktu).',
      ],
    },
  ],
  faq: [
    {
      q: 'Czy zdjęcie z AI spełni wymagania Amazon?',
      a: 'Styl „Białe tło” przygotowuje zdjęcie na czystym białym tle bez napisów, jak wymaga Amazon dla zdjęcia głównego. Przed publikacją porównaj wynik z oryginałem i z aktualnymi wymaganiami w Seller Central.',
    },
    {
      q: 'Czy na zdjęciu głównym Amazon może być plakietka „nowość”?',
      a: 'Nie. Wytyczne Amazon nie dopuszczają tekstu, grafik ani znaków wodnych na zdjęciu głównym, dlatego preset Amazon w AllGrafika blokuje plakietki.',
    },
    PRICE_FAQ,
    NO_INTEGRATION_FAQ,
  ],
  sources: [SRC.amazon],
}

export default content
