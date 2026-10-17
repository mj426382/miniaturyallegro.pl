import type { SeoContent } from '../seoContentLoader'
import { NO_INTEGRATION_FAQ, PRICE_FAQ, SRC } from '../seoShared'

const content: SeoContent = {
  lead: 'eBay pozwala dodać do 24 zdjęć do oferty i ma jasną politykę zdjęć: bez ramek, napisów i znaków wodnych, z produktem pokazanym zgodnie z rzeczywistością. W AllGrafika przygotujesz z jednego zdjęcia z telefonu czysty packshot nowego produktu i dodatkowe ujęcia, a preset eksportu pod eBay ustawi rozmiar pliku.',
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
      heading: 'Galeria oferty na eBay – kolejność zdjęć',
      paragraphs: ['eBay pokazuje pierwsze zdjęcie w wynikach wyszukiwania, a kolejne w galerii oferty. Przy nowym produkcie dobrze działa taki układ:'],
      steps: [
        'Zdjęcie główne: cały produkt na jasnym, jednolitym tle – packshot bez napisów.',
        'Produkt z innych stron: bok, tył, spód, złącza.',
        'Detale: materiał, etykiety, numer modelu, oznaczenia.',
        'Produkt w użyciu lub we wnętrzu – pokazuje skalę i zastosowanie.',
        'Zawartość zestawu i opakowanie.',
      ],
    },
    {
      heading: 'Jak AllGrafika pomaga przy ofercie na eBay',
      paragraphs: [
        'Dla nowych produktów generujesz [packshot na białym tle](/packshot-online) i ujęcia w aranżacji, w których produkt pozostaje wierny oryginałowi. Preset eksportu pod eBay zapisuje plik w proporcji 1:1 lub 4:3 i rozmiarze 1600 px na dłuższym boku, a plakietek promocyjnych i infografik z napisami nie dodawaj do zdjęć na eBay, bo polityka zdjęć ich nie dopuszcza.',
        'Opis i tytuł oferty dopasowane do eBay – tytuł mieści się w limicie 80 znaków – kopiujesz do formularza samodzielnie. Przy przedmiotach używanych dodaj zwykłe zdjęcia konkretnego egzemplarza, tak jak przy [ogłoszeniach na OLX](/zdjecia-produktowe-olx).',
      ],
    },
  ],
  faq: [
    {
      q: 'Czy na zdjęciu na eBay mogę dodać napis „-20%”?',
      a: 'Nie. Polityka zdjęć eBay zabrania dodawania tekstu, ramek i materiałów marketingowych do zdjęć. Promocję opisz w tytule lub opisie oferty.',
    },
    {
      q: 'Czy eBay wymaga białego tła?',
      a: 'Nie. eBay nie narzuca koloru tła, ale wymaga, by zdjęcie dokładnie pokazywało przedmiot bez ramek, napisów i znaków wodnych. Jasne, jednolite tło po prostu ułatwia porównanie ofert.',
    },
    PRICE_FAQ,
    NO_INTEGRATION_FAQ,
  ],
  sources: [SRC.ebayPolicy, SRC.ebayAdding],
}

export default content
