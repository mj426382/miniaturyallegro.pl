# 25 – Darmowe narzędzie „Sprawdź zdjęcie produktu”

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-19 |
| Powiązane | spec 10 (landing, SEO), spec 17 (budżety, AC-PERF-001), spec 08 (presety platform), `landing-page/scripts/blog-keywords.json` (`sources`) |

## 1. Problem i cel

Sprzedawcy przed wgraniem zdjęcia nie wiedzą, czy plik spełnia wymagania platformy (format, wymiary, waga, tło).
Odpowiedzi są rozproszone po pomocach platform, a część popularnych „tabel wymiarów” w internecie to liczby bez źródła.
Darmowe narzędzie na `allgrafika.pl` sprawdza zdjęcie od razu i pokazuje wymaganie z linkiem do oficjalnej strony.

Cel: zasób, do którego blogi i poradniki chętnie linkują (link building), oraz wejście do AllGrafika dla osób,
których zdjęcie nie spełnia wymagań. Sukces: linki zewnętrzne do adresu narzędzia, wejścia z CTA (UTM
`utm_source=landing&utm_medium=tool&utm_content=photo-checker`).

## 2. Zakres

- W zakresie: strona `/narzedzia/sprawdz-zdjecie-produktu` (PL) z narzędziem, opisem, tabelą wymagań ze źródłami,
  FAQ, sekcją „Jak umieścić to narzędzie u siebie” (sam link, bez iframe), linki z landingu.
- Poza zakresem (świadomie): hub `/narzedzia` (jedno narzędzie – hub byłby cienką stroną; powstanie przy drugim
  narzędziu), widget iframe, wysyłanie zdjęć na serwer, ocena treści zdjęcia (napisy, znaki wodne, wypełnienie kadru),
  poprawianie zdjęcia w przeglądarce, wersja anglojęzyczna.

## 3. Decyzje produktowe

- **Wszystko dzieje się lokalnie w przeglądarce.** Plik czytany jest przez `File`/`Blob` na urządzeniu użytkownika;
  ani plik, ani wynik analizy nie są wysyłane (brak żądań sieciowych z danymi zdjęcia, brak zdarzeń analitycznych
  z nazwą pliku). Strona mówi o tym wprost przy polu wyboru pliku i w FAQ.
- **Wymagania platform tylko z oficjalnych stron pomocy lub dokumentacji**, z adresem URL przy każdej wartości
  i datą „sprawdzono”. Gdy platforma nie publikuje wartości – piszemy „brak oficjalnej wartości” i nie oceniamy tego
  punktu. Platformy, których źródła nie da się otworzyć i sprawdzić, nie są w narzędziu. Stan na 2026-10-19:

  | Platforma | Źródło (oficjalne) | Co z niego sprawdzamy |
  |---|---|---|
  | OLX | OLX Group Developer – walidacje eksportu ogłoszeń (OLX.pl) | krótszy bok ≥ 300 px, plik ≤ 5 MB; formaty – brak oficjalnej wartości (pomoc pomoc.olx.pl wymaga logowania) |
  | Vinted | Zasady katalogu, pomoc Vinted | tylko zasady treści (do 20 zdjęć, własne, bez edycji) – wartości techniczne: brak oficjalnej wartości |
  | eBay | Picture policy, „Adding pictures to your listings” | dłuższy bok ≥ 500 px, ok. 1600 px zalecane, ≤ 12 MB, formaty JPEG/PNG/GIF/TIFF/BMP/WEBP/HEIC/AVIF, proporcje 1:1 lub 16:9 |
  | Amazon (zdjęcie główne) | Seller Central – wpis pracownika Amazon na forum sprzedawców (strona G1881 wymaga logowania) | JPEG/TIFF/PNG, ≥ 1000 px dłuższego boku dla zoomu, czysta biel (szacunek), brak przezroczystości |
  | Shopify | Help Center – typy mediów produktu | formaty, ≤ 5000 × 5000 px i 25 MP, < 20 MB, kwadrat 2048 px zalecany |
  | WooCommerce | Developer Docs – rozmiary obrazów | domyślne rozmiary motywu: zdjęcie produktu 600 px szerokości, miniatury przycinane do kwadratu |
  | Shoper | Pomoc i Shoper Learn | sugerowane 1000 px dłuższego boku |
  | PrestaShop | Dokumentacja PrestaShop 9 (webservice, ustawienia obrazów) | formaty GIF/JPEG/PNG przy przesyłaniu przez webservice |
  | Google Merchant Center | Pomoc Merchant Center – wymagania dotyczące zdjęć | formaty, ≥ 500 × 500 px (od 31.01.2027), zalecane ≥ 1500 × 1500 px, ≤ 64 MP, ≤ 16 MB |

  1 MB w narzędziu = 1 000 000 bajtów (ostrożniej niż 1 048 576 – nie dajemy fałszywego „Zgodne”).
- **Wynik per platforma**: „Zgodne” (pass), „Uwaga” (warning – zalecenie, wartość szacunkowa albo wymóg obowiązujący
  od przyszłej daty), „Niezgodne” (fail – twardy limit z dokumentacji), „Brak danych” (platforma nie publikuje wartości,
  które da się sprawdzić). Status nie opiera się wyłącznie na kolorze (tekst + ikona).
- **Białe tło to szacunek**: liczymy piksele w pasie przy krawędzi (2% krótszego boku, min. 1 px) zdjęcia
  zmniejszonego w przeglądarce; „czysta biel” to R, G, B ≥ 254 (tolerancja kompresji JPEG). Strona nazywa to
  szacunkiem i nie ocenia wypełnienia kadru ani napisów.
- **HEIC** – oznaczamy, które platformy według swojej dokumentacji go nie przyjmują (Amazon, Google Merchant Center,
  PrestaShop przez webservice) i które przyjmują (eBay, Shopify). Wymiary HEIC/AVIF odczytujemy z nagłówka pliku,
  nawet gdy przeglądarka nie umie go wyświetlić.
- **Wydajność**: kod strony narzędzia i analizy jest osobnym chunkiem ładowanym tylko na tej trasie (strona główna
  go nie pobiera, budżet AC-PERF-001 bez zmian). Treść objaśniająca jest prerenderowana; pole wyboru pliku działa
  po hydratacji.
- **Linkowanie**: stopka każdej strony („Produkt” → „Sprawdź zdjęcie produktu”), strona główna (sekcja „Gdzie
  wykorzystasz zdjęcia”), strony docelowe OLX, Vinted, eBay, Amazon, sklep internetowy i białe tło. Narzędzie linkuje
  te strony docelowe, wpisy bloga o wymiarach i formatach oraz rejestrację w aplikacji (CTA z UTM).

## 4. Przepływ użytkownika (UX)

1. Użytkownik wybiera jedno lub więcej zdjęć (przycisk wyboru plików – także aparat/galeria na telefonie – albo
   przeciągnięcie na pole).
2. Dla każdego pliku: karta z nazwą, podglądem, formatem, wymiarami, proporcjami, orientacją, wagą, przezroczystością,
   szacunkiem białego tła i tabelą platform (status + szczegóły z linkiem do źródła i strony o platformie) oraz
   wskazówkami prostym językiem.
3. Region `aria-live` ogłasza wynik („Sprawdzono 2 zdjęcia …”). Przycisk „Wyczyść wyniki”.
4. Błędy: plik uszkodzony/nieobsługiwany → komunikat w karcie, bez awarii strony; pozostałe pliki są oceniane.
5. CTA „Popraw zdjęcie w AllGrafika” → rejestracja z UTM.

## 5. Kryteria akceptacji

- **AC-TOOL-001** – Given wygenerowane pliki testowe (JPEG, JPEG z obrotem EXIF, PNG z kanałem alfa i bez, PNG z paletą i `tRNS`, WebP stratny, bezstratny i z alfą, AVIF, HEIC, GIF, BMP, TIFF, obraz 1×1, nagłówek 30000 × 20000 px, kwadrat, panorama, pusty plik, losowe bajty, ucięty JPEG), When przeanalizowane, Then rozpoznany jest format, wymiary (z uwzględnieniem obrotu z metadanych), proporcje (np. „4:3”, „≈ 16:9”), orientacja, megapiksele, waga i informacja o kanale alfa, a plik uszkodzony lub nieobsługiwany daje czytelny błąd zamiast wyjątku.
- **AC-TOOL-002** – Given piksele zdjęcia (białe tło, jasnoszare tło, kolorowe tło, przezroczyste tło, produkt dotykający krawędzi), When liczony jest szacunek tła i przezroczystości, Then wynik to odpowiednio „czysta biel”, „jasne, ale nie czysta biel”, „nie białe” i „przezroczyste”, z udziałem pikseli w pasie przy krawędzi.
- **AC-TOOL-003** – Given tabela wymagań platform, When sprawdzona, Then każda platforma ma co najmniej jedno źródło z oficjalnej domeny tej platformy (bez stron osób trzecich), datę „sprawdzono” 2026-10-19, każde wymaganie wskazuje istniejące źródło, punkty niepublikowane są opisane jako „brak oficjalnej wartości”, a ocena pass / warning / fail dla przykładowych zdjęć (małe, duże, HEIC, WebP, przezroczyste, nie białe tło, zła proporcja, przed i po 31.01.2027 dla Google) jest zgodna z tabelą.
- **AC-TOOL-004** – Given strona narzędzia na każdym profilu urządzenia (desktop, iPhone, Pixel, iPad), When użytkownik wybierze kilka zdjęć (także przeciągnięciem na desktopie), Then każde zdjęcie ma kartę z faktami, tabelą platform ze statusem tekstowym i wskazówkami, region `aria-live` ogłasza wynik, pole wyboru ma etykietę i jest osiągalne klawiszem Tab, „Wyczyść wyniki” działa z klawiatury, a przy szerokości 320 px strona nie przewija się w poziomie.
- **AC-TOOL-005** – Given strona narzędzia, When użytkownik sprawdza zdjęcia, Then przeglądarka nie wysyła żadnego żądania innego niż GET, żadne żądanie nie ma treści ani adresu z danymi pliku, a strona mówi, że zdjęcia nie opuszczają urządzenia.
- **AC-TOOL-006** – Given prerenderowana strona narzędzia, When pobrany HTML i otwarta w przeglądarce, Then tytuł ma ≤ 60 znaków, meta description 120–158 znaków, canonical na swój adres, dokładnie jedno `<h1>`, JSON-LD `WebApplication` (darmowa oferta 0 zł, bez ocen), `BreadcrumbList` i `FAQPage` z tymi samymi pytaniami co widoczne FAQ, własny obraz OG 1200×630; HTML zawiera treść objaśniającą, tabelę wymagań z adresami źródeł i datą „sprawdzono” oraz sekcję „Jak umieścić to narzędzie u siebie” z gotowym linkiem (bez iframe); strona jest w sitemapie raz, a hydratacja przebiega bez błędów.
- **AC-TOOL-007** – Given stopka każdej strony, strona główna i strony docelowe OLX, Vinted, eBay, Amazon, sklep internetowy i białe tło, When pobrany HTML, Then linkują narzędzie; narzędzie linkuje te strony docelowe, co najmniej 2 istniejące wpisy bloga i rejestrację `https://app.allgrafika.pl/register` z `utm_source=landing&utm_medium=tool&utm_content=photo-checker`, nie wspomina Allegro i nie linkuje innych produktów spoza AllGrafika.
- **AC-TOOL-008** – Given build produkcyjny landingu, When zbadany jest JS strony głównej i ruch sieciowy przy wejściu na `/`, Then kod narzędzia jest w osobnym chunku, którego strona główna nie ładuje ani nie preloaduje (budżet AC-PERF-001 bez zmian), a strona narzędzia go ładuje.

## 6. API

Brak – narzędzie nie ma backendu.

## 7. Dane i migracje

Brak. Narzędzie nie zapisuje danych (bez localStorage, bez cookies, bez danych klientów).

## 8. Wymagania niefunkcjonalne

- Prywatność (ISO 27001, RODO): brak przetwarzania danych osobowych po stronie serwera; zdjęcie nie opuszcza
  przeglądarki. Analiza nie odczytuje ani nie pokazuje danych EXIF poza orientacją (np. GPS).
- Dostępność: etykiety pól, statusy tekstem, `aria-live`, obsługa klawiaturą, 320 px.
- Wydajność: lazy chunk, analiza pikseli na kopii zmniejszonej do 800 px; obrazy > 60 MP bez analizy pikseli.

## 9. Wpływ na dokumenty

Spec 10 (lista stron indeksowalnych, linkowanie ze stopki i strony głównej), sitemapa, obraz OG. Regulamin
i polityka prywatności bez zmian (brak przetwarzania danych).

## 10. Ryzyka i pytania otwarte

- Platformy zmieniają wymagania – przy zmianie daty „sprawdzono” trzeba ponownie otworzyć każde źródło.
- Wymagania OLX pochodzą z dokumentacji eksportu przez API (partnerzy); formularz w aplikacji może mieć inne limity.
- Amazon: oficjalna strona pomocy G1881 wymaga logowania – cytujemy wpis pracownika Amazon w Seller Central.

## 11. Plan testów

- AC-TOOL-001/002/003 – testy jednostkowe funkcji analizy i reguł (Playwright w Node, pliki generowane `sharp`).
- AC-TOOL-004/005 – Playwright na macierzy urządzeń landingu.
- AC-TOOL-006/007 – prerenderowany HTML + hydratacja; istniejące testy AC-SEO-009/011/015/017/018/019/020 obejmują nową trasę.
- AC-TOOL-008 – test budżetu na buildzie + ruch sieciowy strony głównej.
