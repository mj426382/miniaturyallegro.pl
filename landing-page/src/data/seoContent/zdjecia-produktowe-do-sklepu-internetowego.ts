import type { SeoContent } from '../seoContentLoader'
import { PRICE_FAQ, SRC } from '../seoShared'

const content: SeoContent = {
  lead: 'We własnym sklepie internetowym to Ty ustalasz standard zdjęć – i to on decyduje, czy siatka produktów wygląda profesjonalnie, czy jak przypadkowy zbiór fotek. Poniżej: jakie zdjęcia przygotować dla każdej karty produktu, co o rozmiarach mówią Shopify, WooCommerce, Shoper i PrestaShop, czego wymaga Google Merchant Center i jak przygotować cały katalog ze zdjęć z telefonu w AllGrafika.',
  sections: [
    {
      heading: 'Jakie zdjęcia powinna mieć karta produktu',
      paragraphs: [
        'Nie ma jednej obowiązkowej liczby zdjęć. Dobra galeria odpowiada jednak po kolei na pytania kupującego: co to jest, jak wygląda z każdej strony, z czego jest zrobione, jak duże jest i co jest w zestawie. Taki układ sprawdza się w większości kategorii:',
      ],
      table: {
        caption: 'Galeria zdjęć karty produktu',
        head: ['Pozycja', 'Co pokazać', 'Styl zdjęcia'],
        rows: [
          ['1. Zdjęcie główne', 'Cały produkt, z przodu lub w ujęciu 3/4', '[Packshot](/packshot-online) na białym lub jasnym tle'],
          ['2–3. Inne kąty', 'Bok, tył, spód, zapięcia, złącza', 'Packshot w tym samym tle'],
          ['4. Detal', 'Materiał, fakturę, szwy, wykończenie', 'Zbliżenie'],
          ['5. Skala i użycie', 'Produkt w dłoni, na sylwetce albo we wnętrzu', 'Lifestyle lub produkt w użyciu'],
          ['6. Zestaw', 'Zawartość opakowania i akcesoria', 'Packshot zestawu'],
          ['7. Wymiary i cechy', 'Wymiary, najważniejsze parametry', 'Infografika'],
        ],
      },
    },
    {
      heading: 'Spójny standard zdjęć w całym sklepie',
      paragraphs: [
        'Kupujący ogląda najpierw listę produktów, a dopiero potem kartę. Jeśli jedno zdjęcie jest kwadratowe, a drugie poziome, jedno na białym tle, a drugie na kuchennym blacie, siatka kategorii zaczyna „skakać” i sklep traci wiarygodność. Ustal standard raz i trzymaj się go – szerzej piszemy o tym w poradniku [spójna identyfikacja wizualna sklepu](/blog/spojna-identyfikacja-wizualna-sklepu-internetowego).',
      ],
      bullets: [
        'Jedna proporcja dla całego katalogu – najczęściej 1:1, w modzie często pionowa',
        'To samo tło na wszystkich zdjęciach głównych',
        'Podobna wielkość produktu w kadrze i podobne marginesy',
        'Opisowe nazwy plików i uzupełniony tekst alternatywny – zobacz [SEO zdjęć produktowych](/blog/seo-zdjec-produktowych)',
        'Pliki skompresowane, ale bez widocznych artefaktów',
      ],
    },
    {
      heading: 'Rozmiary zdjęć w Shopify, WooCommerce, Shoper i PrestaShop',
      paragraphs: [
        'Każda platforma sklepowa tworzy z wgranego pliku mniejsze wersje do listy produktów, galerii i miniatur. Zasada ogólna: wgrywaj plik większy niż największy rozmiar, jaki wyświetla Twój motyw (zwykle powiększenie na karcie produktu). Poniżej to, co mówi oficjalna dokumentacja – stan na październik 2026.',
      ],
      table: {
        caption: 'Zdjęcia produktów według dokumentacji platform sklepowych',
        head: ['Platforma', 'Co mówi dokumentacja', 'Co z tego wynika'],
        rows: [
          [
            'Shopify',
            'Kwadratowe zdjęcia produktów zwykle najlepiej wyglądają w rozmiarze 2048 × 2048 px; maksymalnie 5000 × 5000 px (25 MP) i mniej niż 20 MB; zalecana spójna proporcja zdjęć głównych',
            'Wgrywaj kwadrat ok. 2048 px w jednej proporcji',
          ],
          [
            'WooCommerce',
            'Domyślnie miniatura 300 px szerokości (kwadrat), zdjęcie produktu 600 px szerokości bez przycinania, miniatury galerii 100 × 100 px; przycinanie ustawisz w Customizerze',
            'Wgraj plik wyraźnie większy niż 600 px – na powiększenie i do Google Merchant Center',
          ],
          [
            'Shoper',
            'Rozmiary XL (zdjęcie główne w galerii), L (listy produktów), M (okno dodania do koszyka) i XS (miniatury) ustawiasz w edytorze szablonu; wartość w px dotyczy dłuższego boku, a maksimum zależy od szablonu',
            'Sprawdź rozmiar XL w swoim szablonie i wgrywaj większy plik',
          ],
          [
            'PrestaShop',
            'Wystarczy wgrać jeden „główny” plik na tyle duży, by system wygenerował z niego wszystkie rozmiary; po zmianie rozmiarów miniatury generuje się ponownie',
            'Wgraj duży oryginał, po zmianie ustawień obrazów wygeneruj miniatury',
          ],
          ['Inne (np. IdoSell)', 'Nie znaleźliśmy oficjalnych wartości w pikselach', 'Sprawdź pomoc platformy i ustawienia motywu'],
        ],
      },
    },
    {
      heading: 'Google Merchant Center i Zakupy Google',
      paragraphs: ['Jeśli wysyłasz produkty do Google (Zakupy, reklamy produktowe, bezpłatne informacje o produktach), zdjęcie z feedu musi spełnić wymagania Merchant Center. Według pomocy Google:'],
      bullets: [
        'od 31 stycznia 2027 r. minimum 500 × 500 px dla wszystkich produktów, zalecane co najmniej 1500 × 1500 px',
        'maksymalnie 64 megapiksele i 16 MB na plik; formaty JPEG, WebP, PNG, GIF, BMP i TIFF',
        'bez dodanego tekstu promocyjnego, cen, znaków wodnych, ramek i kodów QR',
        'grafiki wygenerowane przez AI muszą zachować osadzone metadane, np. właściwość IPTC DigitalSourceType',
      ],
    },
    {
      heading: 'Grafiki AI w feedzie produktowym – na co uważać',
      paragraphs: [
        'Eksport z AllGrafika zapisuje plik na nowo (kadr, format, rozmiar) i nie dodaje dziś metadanych IPTC oznaczających grafikę AI. Grafiki z AllGrafika wykorzystasz więc swobodnie na stronie sklepu, a do feedu Merchant Center wybierz zdjęcie, które spełnia wymóg Google, albo dodaj metadane we własnym narzędziu przed wysłaniem.',
      ],
    },
    {
      heading: 'Jak przygotować zdjęcia całego katalogu w AllGrafika',
      paragraphs: ['Przy kilkudziesięciu produktach liczy się praca seriami. Tak wygląda proces dla sklepu:'],
      steps: [
        'Sfotografuj wszystkie produkty telefonem w tym samym miejscu i świetle – nawet bez tła i lamp.',
        'Prześlij do 50 zdjęć naraz; dla każdego powstanie zestaw startowy trzech stylów.',
        'Na zdjęcia główne wybierz „Białe tło”, na dalsze pozycje galerii aranżacje, produkt w użyciu i infografiki z wymiarami.',
        'Eksportuj z presetem „Sklep internetowy”: proporcje 1:1, 4:3, 3:4 lub 16:9, 1600 px na dłuższym boku, JPG, PNG lub WebP – i pobierz wszystko w paczce ZIP.',
        'Skopiuj opis produktu przygotowany pod sklep internetowy i wklej go do panelu sklepu razem ze zdjęciami.',
      ],
    },
  ],
  faq: [
    {
      q: 'Ile zdjęć dodać do produktu w sklepie internetowym?',
      a: 'Nie ma jednej reguły. Dobry punkt wyjścia to zdjęcie główne, dwa inne kąty, detal, zdjęcie w użyciu lub ze skalą i – jeśli ma znaczenie – zawartość zestawu oraz wymiary.',
    },
    {
      q: 'Czy mogę użyć zdjęć od producenta albo darmowych zdjęć z internetu?',
      a: 'Tylko jeśli masz do nich prawo, np. zgodę producenta lub licencję. Darmowe zdjęcia stockowe pokazują zwykle podobny, a nie Twój produkt. Więcej w poradniku o prawach autorskich do zdjęć produktów.',
    },
    {
      q: 'Jaki rozmiar zdjęcia wgrać do sklepu?',
      a: 'Większy niż największy rozmiar wyświetlany przez Twój motyw – w praktyce często kwadrat 1500–2048 px. Szczegóły dla WooCommerce, Shopify i Merchant Center znajdziesz w poradniku o rozmiarze zdjęć do sklepu internetowego.',
    },
    {
      q: 'Czy AllGrafika łączy się z moim sklepem?',
      a: 'Nie. AllGrafika nie łączy się ze sklepami ani platformami i nie prosi o hasła. Pobierasz pliki i opis, a produkt aktualizujesz w panelu sklepu samodzielnie.',
    },
    PRICE_FAQ,
  ],
  sources: [SRC.shopify, SRC.woocommerce, SRC.shoper, SRC.prestashop, SRC.merchant],
}

export default content
