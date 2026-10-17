# 08 – Presety platform sprzedażowych (OLX, Vinted, eBay, Amazon, sklep)

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-17 |
| Powiązane | FR-PLT-001, 06 (eksport), 07 (opis oferty), ADR-0003 |
| Zastępuje | Integrację z Allegro (OAuth, import ofert, publikacja zdjęć i opisów) – usuniętą 2026-10-17 |

## 1. Problem i cel

Decyzja właściciela z 2026-10-17: AllGrafika nie obsługuje już Allegro. Narzędzie celuje w sprzedających
na OLX, Vinted, eBay, Amazon i we własnych sklepach internetowych. Zamiast integracji (OAuth, publikacja)
dajemy **presety platform**: użytkownik wybiera platformę, a eksport i opis oferty dopasowują się do jej
zasad. Nie ma żadnych integracji – tylko pobranie pliku i skopiowanie tekstu.

## 2. Decyzje

- **Usunięcie integracji z Allegro**: moduł `backend/src/allegro`, endpointy `/allegro/*`, zmienne
  `ALLEGRO_*`, strona „Allegro” i jej pozycja w nawigacji, przyciski „Opublikuj na Allegro”, import zdjęć
  z ofert. Migracja `20261017090000_remove_allegro` usuwa tabelę `allegro_connections` (tokeny OAuth)
  i kolumnę `images.allegroOfferId` – dane użytkowników związane z Allegro są kasowane, nic innego.
- **Jedno źródło presetów**: `backend/src/generation/platform-presets.ts` (eksport robi sharp na serwerze,
  ADR-0003). Aplikacja pobiera je z `GET /generation/platform-presets`; nie ma kopii liczb we frontendzie.
- Każda reguła presetu ma znacznik **oficjalna** (`official: true`, wymóg z pomocy platformy) albo
  **zalecana** (`official: false`, brak twardej reguły – rozsądna rekomendacja). UI pokazuje zalecane jako
  „zalecane”, nigdy jako wymóg platformy. Każdy preset ma adres źródła.
- **Presety** (zweryfikowane 2026-10-17):

| Platforma | Proporcje (domyślna pierwsza) | Rozmiar (min / docelowy, dłuższy bok) | Tło i kadr | Plakietka | Tytuł | Źródło |
|---|---|---|---|---|---|---|
| Sklep internetowy / ogólne (`generic`) | 1:1, 4:3, 3:4, 16:9 – zalecane | 1000 zalecane / 1600 | białe zalecane na zdjęciu głównym | dozwolona | 75 – zalecane | brak jednej reguły – rekomendacja |
| OLX (`olx`) | 4:3 – oficjalne | 1000 zalecane / 1500 (1500×1125) | bez reguły; bez danych kontaktowych na zdjęciu (oficjalne); JPG/PNG do 5 MB (oficjalne) | dozwolona (bez kontaktu) | 70 – zalecane | [pomoc OLX](https://pomoc.olx.pl/hc/pl/articles/211658765) |
| Vinted (`vinted`) | 3:4, 1:1 – zalecane | 800 zalecane / 1600 | pierwsze zdjęcie pokazuje cały przedmiot, bez kolaży i znaków wodnych (oficjalne) | odradzana – zalecane | 50 – zalecane | [Vinted Help 48](https://www.vinted.co.uk/help/48) |
| eBay (`ebay`) | 1:1, 4:3 – zalecane | 500 oficjalne / 1600 zalecane | bez ramek, tekstu i znaków wodnych (oficjalne) | zabroniona – oficjalne | 80 – oficjalne | [eBay Picture policy](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370) |
| Amazon (`amazon`) | 1:1 – zalecane | 1000 oficjalne / 2000 zalecane | zdjęcie główne: czysto białe tło RGB 255,255,255, produkt ≥ 85 % kadru (oficjalne); JPEG preferowany | zabroniona na zdjęciu głównym – oficjalne | 75 – oficjalne (od 2026-07-27) | [Seller Central G1881](https://sellercentral.amazon.com/help/hub/reference/external/G1881) |

- **Eksport z presetem** (`platform` w żądaniu): proporcje muszą należeć do presetu (400 w innym razie),
  format pliku do listy presetu (400), rozmiar domyślnie = docelowy presetu i nigdy poniżej minimum presetu,
  plakietka przy presecie z plakietką zabronioną → 400. Nazwa pliku zawiera platformę:
  `grafika-<styl>-<platforma>-<proporcje>.<ext>`. Bez `platform` eksport działa jak dotąd (06).
- **Amazon – wypełnienie kadru**: przy „Całej grafice” (bez kadru) eksport obcina jednolicie białe
  marginesy grafiki i skaluje produkt tak, by dłuższy wymiar zajmował 85 % płótna, wyśrodkowany na
  czystej bieli. Grafika bez białych marginesów jest tylko dopasowana na białym tle. AI nie zmienia tła –
  UI przypomina, by na zdjęcie główne Amazon wybrać grafikę w stylu „Białe tło”.
- **Opis oferty** (07) korzysta z tych samych presetów: limit tytułu i wskazówki promptu zależą od
  wybranej platformy; domyślnie `generic`.
  Platforma opisu jest zapisana w kolumnie `offer_descriptions.platform` (migracja
  `20261017091000_offer_description_platform`: `ADD COLUMN IF NOT EXISTS … DEFAULT 'generic'` – istniejące
  opisy dostają `generic`, bez przepisywania danych).

## 3. API

`GET /generation/platform-presets` → lista presetów `{ id, label, ratios[], defaultRatio, minSize, targetSize,
formats[], defaultFormat, productFill|null, badge: 'allowed'|'discouraged'|'forbidden', titleMaxLength,
rules[{ text, official }], source }`.
`POST /generation/export/:id { platform?, ratio, … }` (06).

## 4. Kryteria akceptacji

- **AC-PLT-001** – Given lista presetów, When pobrana z `GET /generation/platform-presets`, Then zawiera dokładnie `generic`, `olx`, `vinted`, `ebay`, `amazon`, każdy z proporcjami, rozmiarem minimalnym i docelowym, formatami, limitem tytułu, regułami ze znacznikiem oficjalna/zalecana i adresem źródła; Amazon ma białe tło, wypełnienie 0,85 i zakaz plakietki, eBay min. 500 px i tytuł 80.
- **AC-PLT-002** – Given preset platformy, When eksport bez rozmiaru albo z rozmiarem poniżej minimum, Then plik ma rozmiar docelowy presetu albo jego minimum (np. OLX 4:3 → 1500×1125, Amazon 600 px → 1000×1000).
- **AC-PLT-003** – Given preset platformy, When proporcje lub format spoza presetu albo plakietka przy presecie, który jej zabrania, Then 400.
- **AC-PLT-004** – Given grafika z białymi marginesami i preset Amazon bez kadru, When eksport, Then produkt zajmuje ok. 85 % dłuższego boku, a narożniki są czysto białe (255,255,255).
- **AC-PLT-005** – Given endpoint eksportu z `platform`, When eksport, Then nazwa pliku zawiera platformę i proporcje (`grafika-<styl>-olx-4x3.jpg`), a nieznana platforma → 400.
- **AC-PLT-006** – Given modal eksportu, When użytkownik wybierze platformę, Then widzi jej proporcje i reguły z etykietą „wymóg platformy” albo „zalecane”, a żądanie zawiera `platform`, proporcje i rozmiar docelowy presetu.
- **AC-PLT-007** – Given preset z zabronioną plakietką (eBay, Amazon), When drugi krok modalu, Then pole plakietki jest wyłączone z wyjaśnieniem, a żądanie nie zawiera plakietki.
- **AC-PLT-008** – Given aplikacja po usunięciu Allegro, When użytkownik przegląda nawigację i stare adresy `/allegro`, Then nie ma pozycji „Allegro”, a stary adres prowadzi do strony 404.
