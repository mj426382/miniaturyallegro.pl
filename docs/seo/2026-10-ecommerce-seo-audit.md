# Audyt SEO AllGrafika.pl – e-commerce ogólnie (październik 2026)

| Pole | Wartość |
|---|---|
| Data | 2026-10-17 |
| Zakres | `landing-page/` (strona główna, strony docelowe, blog 48 wpisów), produkcja https://allgrafika.pl |
| Cel właściciela | Wysokie pozycje na frazy e-commerce ogólnie („zdjęcia produktowe”, „fotografia produktowa”, „packshot”, „zdjęcia do sklepu internetowego”…), nie tylko na frazy platform |
| Powiązane | spec 10 (`docs/specs/10-landing-seo.md`), `landing-page/src/data/seoPages.ts`, `landing-page/src/data/topicClusters.ts` |

## 1. Metoda i ograniczenia

- **Brak danych o wolumenach.** Nie mamy dostępu do Planera słów kluczowych Google ani narzędzi typu Senuto/Ahrefs,
  a Google Search Console nie była dostępna w tej sesji. **Nie podajemy więc żadnych liczb wyszukiwań.** Frazy
  szeregujemy według dowodów, które dało się zweryfikować:
  1. **Autouzupełnianie Google (pl-PL)** – pobrane 2026-10-17 z `suggestqueries.google.com` dla ~140 fraz
     startowych i ich wariantów alfabetycznych. Obecność frazy w podpowiedziach oznacza realny, powtarzalny popyt;
     liczba i różnorodność rozwinięć (np. „zdjęcia produktowe” → *ai, jak robić, cena, telefonem, w domu, na białym
     tle, na czarnym tle, 360 stopni, świąteczne*) świadczy o szerokości tematu.
  2. **SERP / konkurencja** – wyszukiwania 2026-10-17: kto zajmuje wyniki i jakim typem strony (usługa, poradnik,
     narzędzie).
  3. **Zgodność z produktem** – czy AllGrafika rzetelnie rozwiązuje problem z frazy (bez obietnic, których nie spełnia).
- Skala dowodów w tabelach: **A** – fraza i wiele rozwinięć w autouzupełnianiu; **B** – fraza w autouzupełnianiu bez
  (lub z 1–2) rozwinięciami; **C** – brak w autouzupełnianiu (niski lub żaden popyt w PL).
- Allegro jest poza zakresem (decyzja właściciela 2026-10-17) – nie celujemy w żadną frazę z „allegro”, choć Google
  podpowiada np. „zdjęcia produktowe allegro”.

## 2. Krajobraz konkurencji (SERP, 2026-10-17)

| Typ wyników | Kto | Wniosek |
|---|---|---|
| Usługi fotograficzne + rozbudowany blog | marszalstudio.pl (dziesiątki podstron: packshot, cennik, białe tło, rozmiar zdjęć do sklepu, „zdjęcia na białym tle”), lokalne studia (Warszawa, Kraków, Wrocław…) | Dominują frazy „packshot”, „fotografia produktowa”, „zdjęcia na białym tle”, „packshot cena”. Wygrywają głębią tematu – potrzebujemy stron filarowych z realną treścią, nie cienkich landingów. |
| Poradniki platform sklepowych | shoper.pl/learn („zdjęcia produktów”, rozmiar zdjęć w galerii), shopify.com/pl/blog/fotografia-produktowa | Frazy poradnikowe „jak robić zdjęcia do sklepu internetowego” – konkurujemy wpisami blogowymi + stroną filarową o sklepie. |
| Narzędzia AI (często spolszczone strony zagranicznych firm) | TopView, OpenArt, Dreamina (CapCut), Photoroom, Fotographer, AI Packshot, dodatki Google Workspace; Shoper ma własny generator zdjęć AI w panelu | Frazy „zdjęcia produktowe ai”, „generator zdjęć produktowych ai”, „packshot ai” mają intencję narzędziową i słabszą polską konkurencję treściową – to nasza największa szansa. Wyróżnik: produkt wierny oryginałowi, presety eksportu pod platformy, opis oferty, ceny w zł. |
| Usuwanie / zmiana tła | Canva, remove.bg, Adobe, aplikacje telefonów | Frazy ogromne, ogólne („usuwanie tła ze zdjęcia”), zdominowane przez globalne marki – celujemy tylko w warianty produktowe (białe tło zdjęcia produktu) i w poradnik blogowy. |
| Ceny | kb.pl (średnia cena packshotu w PL 58,29 zł brutto/szt., rozpiętość 50,76–72,21 zł), cenniki studiów (np. 39 zł netto bez retuszu, 74 zł z retuszem) | Frazy cenowe obsługuje wpis o kosztach; podajemy tylko ceny ze źródłem. |

## 3. Klastry słów kluczowych → adres docelowy

Intencja: **T** – transakcyjna/narzędziowa, **K** – komercyjna (porównanie, cena), **I** – informacyjna (poradnik).

| # | Klaster | Frazy (przykłady z autouzupełniania) | Intencja | Dowód | Adres docelowy |
|---|---|---|---|---|---|
| 1 | **Zdjęcia produktowe AI** (rdzeń) | zdjęcia produktowe ai, zdjęcia produktowe z ai, ai do zdjęć produktowych, aplikacja do zdjęć produktowych (darmowa), program do zdjęć produktowych, grafika produktowa ai, grafiki produktowe | T | A („zdjęcia produktowe ai” to 1. podpowiedź dla „zdjęcia produktowe”) | `/` – strona główna |
| 2 | **Generator zdjęć produktowych** | generator zdjęć produktowych, generator zdjęć produktowych ai, generator zdjęć ai na podstawie zdjęcia, zdjęcia ai do ofert | T | B | `/zdjecia-ai-do-ofert` (przeprofilowana na „Generator zdjęć produktowych AI”) |
| 3 | **Fotografia produktowa / sesja produktowa** | fotografia produktowa (co to, jak zacząć, ai, w domu, telefonem, akcesoria), sesja produktowa (ai, co to, cena), zdjęcia produktowe co to | T/I | A | **nowa** `/fotografia-produktowa-ai` |
| 3a | Ceny zdjęć produktowych | zdjęcia produktowe cena, fotografia produktowa cennik, ile kosztują zdjęcia produktowe, ile kosztuje sesja produktowa, ile kosztuje packshot, packshot cena | K | B | wpis `/blog/koszty-fotografii-produktowej-vs-ai-roi` (nowy tytuł „Ile kosztują zdjęcia produktowe?…”) |
| 4 | **Packshot** | packshot, packshot co to (jest / znaczy), packshoty, jak zrobić packshot, packshot online, packshot ai, packshot ai generator, packshot lifestyle | T/I | A | **nowa** `/packshot-online` |
| 5 | **Białe tło** | jak zrobić zdjęcie produktu na białym tle, zdjęcie na białym tle aplikacja, białe tło do zdjęć produktowych, zdjęcia produktowe na białym tle, zmiana tła zdjęcia na białe online | T | A | `/biale-tlo-zdjecie-produktu` (rozbudowana; bez duplikatu) |
| 5a | Usuwanie tła | usuwanie tła ze zdjęcia (online, za darmo, ai), zmiana tła zdjęcia ai | I/T | A, ale SERP zdominowany przez Canva/remove.bg | wpis `/blog/jak-usunac-tlo-ze-zdjecia-produktu` |
| 6 | **Zdjęcia do sklepu internetowego** | zdjęcia do sklepu internetowego, zdjęcia produktów do sklepu internetowego, jak zrobić dobre zdjęcia do sklepu internetowego, zdjęcia ubrań do sklepu internetowego, darmowe zdjęcia do sklepu internetowego, shoper zdjęcia produktów, shoper rozmiar zdjęcia | T/I | A | **nowa** `/zdjecia-produktowe-do-sklepu-internetowego` |
| 6a | Rozmiar zdjęć w sklepie | jaki rozmiar zdjęcia do sklepu internetowego; (Shopify/WooCommerce/PrestaShop/IdoSell – brak polskich podpowiedzi) | I | B / C | wpis `/blog/jaki-rozmiar-zdjecia-do-sklepu-internetowego` + sekcja platform na stronie sklepu |
| 7 | **Marketplace i ogłoszenia** | zdjęcia na olx (jakie, rozmiar, format), zdjęcia na vinted (ai, jak zrobić, dobre, ubrań, butów), zdjęcia na ebay, zdjęcia na amazon | T/I | A (OLX, Vinted), C (eBay, Amazon po polsku) | `/zdjecia-produktowe-olx`, `-vinted`, `-ebay`, `-amazon`; wymiary → wpis `wymiary-zdjec-olx-vinted-ebay-amazon` |
| 8 | Jak robić zdjęcia produktów | jak robić zdjęcia produktów (telefonem, profesjonalne, dobre), zdjęcia produktowe telefonem, zdjęcia produktowe w domu, jak zrobić zdjęcia produktowe w domu | I | A | wpisy `jak-zrobic-profesjonalne-zdjecia-produktow` (tytuł „…w domu”) i `zdjecia-produktow-telefonem-poradnik` (tytuł „Jak robić zdjęcia produktów telefonem…”) |
| 9 | Opis produktu | jak napisać (dobry) opis produktu, opis produktu przykład, opis produktu seo, opis produktu ai, generator opisów produktów (ai, darmowy), opis produktu na vinted | I/T | A | wpis `jak-napisac-opis-produktu-do-sklepu-i-ogloszenia` + funkcja na stronie głównej. **Bez osobnej strony „generator opisów”** – opis powstaje tylko do zdjęcia z gotową grafiką, więc strona narzędziowa obiecywałaby za dużo (decyzja dla właściciela, §7). |
| 10 | Style i tła | zdjęcia produktowe na czarnym tle; zdjęcia (produktowe) lifestyle, packshot lifestyle; tło do zdjęć produktowych, tło fotograficzne do zdjęć produktowych; zdjęcia produktowe świąteczne; oświetlenie do zdjęć produktowych | I | B | wpisy: dark luxury (tytuł „Zdjęcia produktowe na czarnym tle…”), białe tło vs lifestyle, wpływ tła (tytuł „Tło do zdjęć produktowych…”), grafiki świąteczne, oświetlenie DIY |
| 11 | Infografiki produktowe | infografika produktowa, infografiki produktowe | T | B | sekcja na stronie głównej (infografiki gratis); kandydat na przyszłą stronę docelową |
| 12 | Masowa obróbka | masowa obróbka zdjęć, masowa edycja zdjęć | I/T | B (część dotyczy Lightrooma) | wpis `batch-processing-…` (tytuł „Masowa obróbka zdjęć produktowych…”) |
| 13 | Platformy sklepowe | shopify zdjęcia, woocommerce zdjęcia produktów, prestashop zdjęcia, idosell zdjęcia | I | C – brak podpowiedzi po polsku | **bez osobnych stron** (byłyby cienkie); sekcja z oficjalnymi danymi na stronie „zdjęcia do sklepu internetowego” |
| 14 | Inne marketplace’y | etsy (podpowiedzi to ramki/albumy – brak intencji), empik marketplace (logowanie, prowizja – brak „zdjęcia”), erli (sklep, opinie) | – | C | nie celujemy; nie znaleźliśmy też oficjalnych wymagań zdjęć Empik/Erli, więc nie piszemy o nich faktów |
| 15 | Lokalne studia | zdjęcia produktowe warszawa / kraków / wrocław…, packshoty warszawa | intencja „usługa lokalna” | A | nie celujemy (inny produkt) |

**Kanibalizacja – zasady po zmianach**

- Strona główna celuje w „zdjęcia produktowe AI” (rdzeń). `/zdjecia-ai-do-ofert` celuje w „generator zdjęć
  produktowych AI” (narzędzie, demo, proces). Wpis `jak-wykorzystac-ai-do-zdjec-produktowych` – w „gdzie wolno używać
  zdjęć AI” (poradnik zasad).
- `/packshot-online` (definicja, standard, rodzaje ujęć packshotu) vs `/biale-tlo-zdjecie-produktu` (jak zrobić białe
  tło z telefonu, aplikacja, wymagania białego tła) vs wpis „Białe tło DIY vs AI” (porównanie metod).
- `/zdjecia-produktowe-do-sklepu-internetowego` (zestaw zdjęć karty produktu, platformy sklepowe, Merchant Center) vs wpis
  „Jaki rozmiar zdjęcia do sklepu internetowego” (szczegóły pikseli i kompresji).
- `/fotografia-produktowa-ai` (sesja vs AI, kiedy co) vs wpis o kosztach (ceny) vs wpis „Jak zrobić profesjonalne zdjęcia
  produktów w domu” (instrukcja DIY).
- Frazy stron docelowych są zarezerwowane dla nich: bot bloga czyta `keywords` z `seoPages.ts` i pomija te tematy.

## 4. Audyt techniczny (produkcja, 2026-10-17)

Pomiar: `curl` stron produkcyjnych + build lokalny (`CI=1 npm run build`) i Lighthouse 12.8 (mobile, domyślny throttling)
na **naprawionym** podglądzie (`vite preview` z pluginem `prerenderedRoutesPlugin` – zwykły podgląd SPA podaje HTML strony
głównej pod każdym adresem i fałszuje wyniki).

### Co działa dobrze

- SSG: każda trasa ma pełny HTML i własny `<head>` (title, description, canonical, OG, Twitter, JSON-LD); hydratacja bez błędów.
- Przekierowania: `http→https`, `www→apex`, ukośnik na końcu → 308; stare adresy z „allegro” → 301 bez łańcuchów
  (`check-redirects.js` w buildzie).
- 404: prawdziwy status 404 i `noindex`.
- `robots.txt` wskazuje sitemapę; sitemapa ma 56 adresów, wszystkie 200.
- Tytuły ≤ 60 znaków, opisy ≤ 160 (reguła AC-SEO-009), canonicale poprawne, wszystkie obrazy mają `alt`.
- Lighthouse SEO 100 na wszystkich mierzonych stronach.

### Znaleziska (priorytet: P1 – wpływ na ranking/CTR teraz, P2 – istotne, P3 – kosmetyka)

| # | Pri | Znalezisko | Dowód | Naprawa |
|---|---|---|---|---|
| T1 | P1 | Pozycjonowanie strony głównej zbyt wąskie – tytuł „Zdjęcia produktowe AI na OLX, Vinted i eBay”, hero „Dla sprzedawców na OLX, Vinted…”. Brak treści i linków do tematów sklepu internetowego, packshotu, fotografii produktowej. | tytuł i H1 produkcji | Nowy tytuł/H1/opis „Zdjęcia produktowe AI dla sklepów i ogłoszeń”, sekcja „Gdzie wykorzystasz zdjęcia” z linkami do wszystkich stron docelowych, FAQ e-commerce. |
| T2 | P1 | Brak stron docelowych dla głównych klastrów e-commerce (packshot, fotografia produktowa, zdjęcia do sklepu internetowego). | §3 | 3 nowe strony z unikalną treścią, tabelami, źródłami, FAQ i CTA. |
| T3 | P1 | Tekst H1 sklejony: `<br/>` bez spacji daje w HTML „Zdjęcia produktowe z AI**z** jednej fotki…”, „Zdjęcia AI do ofert**z** jednego…” – tak widzi to Google (podgląd, fragmenty). | `curl`: `h1: Zdjęcia produktowe z AIz jednej fotki z telefonu` | Spacja przed łamaniem linii na wszystkich stronach. |
| T4 | P1 | Brak klastrów tematycznych: `/blog` to płaska lista 48 wpisów; „Przeczytaj również” dobierane po kategorii; tylko 8 linków z treści wpisów do stron docelowych; strony docelowe linkują 3 wpisy. | `grep` linków w `blogPosts` | `topicClusters.ts`: 7 klastrów z hubami na `/blog`, każdy wpis linkuje stronę filarową i wpisy z klastra, strony docelowe linkują się nawzajem. |
| T5 | P1 | Linki wewnętrzne w treści wpisów otwierają się w nowej karcie (`target="_blank"`, pełny URL). | 7 takich linków w jednym wpisie | Linki do allgrafika.pl jako zwykłe linki w tej samej karcie (ścieżka względna). |
| T6 | P1 | Fałszywa obietnica w CTA każdego wpisu: „10 generacji gratis” (od 2026-10-09 jest 5 darmowych grafik). | `BlogPost.tsx` | „5 grafik gratis”. |
| T7 | P2 | Listy we wpisach renderowane jako `<li>` bez `<ul>` (niepoprawny HTML, Lighthouse „listitem”), listy numerowane jako akapity, check-listy jako „[ ]”, puste linie jako `<br>`. | Lighthouse post: a11y 92 | Renderer grupuje listy w `<ul>/<ol>`, check-listy jako lista z ☐. |
| T8 | P2 | Sitemapa: `lastmod` strony głównej = data buildu (zmienia się przy każdym wdrożeniu – nieprawdziwa data); dwa generatory sitemapy (plugin Vite i skrypt) z tą samą logiką. | `sitemap.xml` | Jedno źródło (`generate-sitemap.js`), `lastmod` z dat treści (`HOME_UPDATED`, `SEO_PAGES_UPDATED`, `modifiedAt`). |
| T9 | P2 | Dane strukturalne: `/blog` bez JSON-LD; wpisy z sekcją FAQ bez `FAQPage`; encje `Organization`/`WebSite`/`SoftwareApplication` niepowiązane (`@id`); ceny w JSON-LD wpisane ręcznie (ryzyko rozjazdu z `backend/src/payments/plans.ts`). | `curl` | `@id`-owany graf, `Blog`+`ItemList`+`BreadcrumbList` na `/blog`, `BlogPosting`(+`FAQPage`) we wpisach, `AggregateOffer` z cen w `src/data/pricing.ts`, test zgodności z backendem. |
| T10 | P2 | Jeden obraz OG (z tekstem „OLX · Vinted · eBay · Amazon”) dla wszystkich stron; brak `og:image:width/height` na stronach docelowych i `/blog`. | `<head>` | Obrazy OG per strona docelowa + blog, wymiary i `alt`. |
| T11 | P2 | Kontrast: `text-gray-400` na białym (2,53:1), szary w stopce na `gray-900` (3,66:1), `blue-200` na `blue-600` (3,63:1). | Lighthouse a11y 92–96 | Ciemniejsze odcienie (≥ 4,5:1). |
| T12 | P2 | CSS (23 KB) blokuje renderowanie – FCP 2,9 s w symulacji mobilnej; fonty Google z zewnętrznej domeny. | Lighthouse „render-blocking” | CSS wstawiany inline przez prerender (≈5 KB gzip), mniej zapytań przed pierwszym renderem. |
| T13 | P2 | Rozbudowa treści stron docelowych zwiększa wspólny bundle JS (wszystkie treści w jednym pliku). | 89 KB gzip JS na każdej stronie | Treść stron docelowych w osobnych chunkach ładowanych leniwie (jak wpisy). |
| T14 | P2 | Słabe `alt` zdjęć przed/po („Bluza z kapturem – Odzież – po”); zdjęcie „przed” 138 KB. | HTML | Opisowe `alt` („…zdjęcie produktowe AI, styl Białe tło” / „…oryginalne zdjęcie z telefonu”), ponowna kompresja. |
| T15 | P2 | Tytuły części wpisów nie zaczynają się od frazy (np. „Dark luxury…”, „Koszty fotografii…”, „Batch processing…”, „Jak dostosować miniaturki…”) albo używają starego słowa „miniaturki”. | lista tytułów | Nowe tytuły z frazą na początku (sluga bez zmian). |
| T16 | P3 | Hierarchia nagłówków: H3 stopki bez H2, H3 w ramce CTA wpisu przed H2. | `curl` | Stopka i CTA bez nagłówków udających strukturę treści. |
| T17 | P3 | `/regulamin` i `/polityka-prywatnosci` poza sitemapą. | sitemap | Celowo – brak wartości wyszukiwania; strony nadal indeksowalne i podlinkowane w stopce. |
| T18 | P2 (produkt) | Google Merchant Center wymaga, by grafiki wygenerowane przez AI zachowały metadane (np. IPTC `DigitalSourceType`). Eksport w backendzie (`sharp`) nie zachowuje ani nie dodaje metadanych. | `backend/src/generation/export.service.ts` | Poza zakresem strony – zalecenie dla właściciela/aplikacji (§7). Na stronach podajemy wymóg Google bez obietnicy, że pliki go spełniają. |

**Cienkie wpisy.** Najkrótszy wpis ma ok. 610 słów, każdy ma własny temat i źródła – żaden nie jest „cienki”
w rozumieniu Google. Ryzykiem jest nakładanie się tematów w klastrze „psychologia zdjęć” (8 wpisów o tym, jak zdjęcie
wpływa na odbiór). Zamiast łączyć wpisy (utrata adresów, przekierowania) porządkujemy je w jeden klaster z hubem
i jednoznacznymi tytułami; po 2–3 miesiącach warto sprawdzić w GSC, czy dwa wpisy nie zbierają wyświetleń na te same
zapytania (wtedy połączyć z 301).

## 5. Lighthouse (mobile, naprawiony podgląd, `lighthouse@12.8.2`)

| Strona | Przed: perf / SEO / a11y / BP | Przed: FCP · LCP · TBT · CLS | Po: perf / SEO / a11y / BP | Po: FCP · LCP · TBT · CLS |
|---|---|---|---|---|
| `/` | 84 / 100 / 96 / 100 | 2,9 s · 3,7 s · 110 ms · 0,004 | _uzupełniane po wdrożeniu zmian_ | |
| `/biale-tlo-zdjecie-produktu` | 84 / 100 / 96 / 100 | 2,9 s · 3,7 s · 70 ms · 0,009 | | |
| `/blog` | 90 / 100 / 96 / 100 | 2,9 s · 2,9 s · 0 ms · 0,001 | | |
| `/blog/jaki-rozmiar-zdjecia-do-sklepu-internetowego` | 89 / 100 / 92 / 100 | 2,9 s · 3,0 s · 0 ms · 0,048 | | |

Uwaga: `vite preview` nie kompresuje odpowiedzi (Vercel tak), więc wartości lokalne są zawyżone względem produkcji.

## 6. Wdrożone zmiany

_Sekcja uzupełniana w trakcie wdrożenia – patrz §8._

## 7. Rekomendacje wymagające właściciela

_Patrz §8._
