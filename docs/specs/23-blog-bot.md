# 23 – Bot bloga: przekrojowe artykuły e-commerce

| Pole | Wartość |
|---|---|
| Status | Wdrożone (2026-10-17) |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-17 |
| Powiązane | 10-landing-seo.md (AC-SEO-004…006, 008, 012), 02-pricing.md, 08-platform-presets.md |

## 1. Problem i cel

Blog ma budować widoczność AllGrafika w Google dla **e-commerce w ogóle**, a nie tylko dla poradników „jak zrobić zdjęcie
na platformę X”. Dotychczasowy bot pisał codziennie, tematy wybierał w dużej mierze sam model, a plan słów kluczowych był
płaską listą bez klastrów i bez dowodów, że ktoś tych fraz szuka. Skutek: duplikaty (ponad sto wpisów połączonych 301 w
`vercel.json`), tematy wąskie i podobne do siebie.

Cel: bot pisze rzetelne, przekrojowe artykuły (przewodniki filarowe, porównania, checklisty, instrukcje, teksty sezonowe)
wokół zbadanych zapytań z ośmiu klastrów e-commerce, rotuje klastry i typy, pilnuje jakości kodem i nigdy nie publikuje
zmyślonych liczb, faktów o platformach bez oficjalnego źródła ani tekstów o Allegro.

Miara sukcesu: wyświetlenia i kliknięcia z Google Search Console dla wpisów z planu (po 3 miesiącach), zero wpisów
odrzuconych ręcznie za zmyślone dane, zero nowych duplikatów w `check_blog_duplicates.py`.

## 2. Zakres

- W zakresie: plan tematów (`landing-page/scripts/blog-keywords.json`), dziennik (`blog-keywords-used.json`), wybór tematu
  (`blog_plan.py`), bramki jakości (`blog_quality.py`), generator (`generate-blog-post.py`), workflow
  `.github/workflows/daily-blog.yml`, przykładowy artykuł do dry runu (`scripts/fixtures/blog-post.sample.json`).
- Poza zakresem (świadomie): treść istniejących wpisów i strony landingu (osobna praca), wyszukiwanie wolumenów fraz
  w płatnych narzędziach (nie podajemy wolumenów – tylko dowody z podpowiedzi Google i wyników wyszukiwania),
  automatyczne odświeżanie starych wpisów.

## 3. Decyzje produktowe

- **D1 – Osiem klastrów.** Fotografia produktowa · Zdjęcia według kategorii · Sprzedaż i konwersja · SEO sklepu ·
  Kanały sprzedaży (własny sklep: Shopify, WooCommerce, PrestaShop, Shoper, IdoSell; marketplace'y i serwisy: OLX,
  Vinted, eBay, Amazon, Etsy, Empik Marketplace, Erli) · Sezon i kampanie · AI w e-commerce · Prawo i praktyka (AI Act,
  GPSR, Omnibus, zwroty, prawa do zdjęć, dostępność). Każdy wpis planu ma: frazę, klaster, intencję, typ, kąt, priorytet
  1–3, min. 2 linki wewnętrzne do istniejących stron, dowód (`evidence`) i opcjonalnie sezon oraz źródła.
- **D2 – Kadencja pon/śr/pt zamiast codziennie.** Krótszy plan publikacji i dłuższe przewodniki filarowe dają lepszą
  jakość niż 7 krótkich tekstów tygodniowo: codzienny bot wyprodukował ponad sto duplikatów połączonych potem 301,
  a masowe, cienkie treści AI są ryzykiem w wytycznych Google (scaled content). 64 zbadane tematy wystarczają na ok.
  5 miesięcy; potem bot nie pisze nic, dopóki plan nie zostanie rozszerzony (bez wolnych tematów wymyślanych przez model).
- **D3 – Typy i rotacja.** `pillar` (min. 1800 słów, 7 H2, 4 linki wewnętrzne, 5 pytań FAQ), `guide`, `howto`,
  `comparison` (min. 1000 słów), `checklist`, `seasonal` (min. 900 słów); każdy typ ma własną strukturę w briefie.
  Kolejność wyboru: (1) inny klaster niż poprzedni wpis, (2) temat sezonowy w oknie 6–3 tygodnie przed wydarzeniem
  (najpierw najbliższe wydarzenie), (3) przewodnik filarowy, jeśli nie było go w ostatnich 5 wpisach, (4) inny typ niż
  poprzedni, (5) priorytet, (6) klaster z najmniejszą liczbą wpisów, (7) kolejność w planie. Gdy zostaje tylko ten sam
  klaster, bot go bierze i zaznacza to w podsumowaniu.
- **D4 – Napraw kodem, odrzuć z powodem.** Kod skraca tytuł do ≤ 60 i opis meta do ≤ 158 znaków, przepina linki do
  połączonych wpisów na cel 301, zamienia listy numerowane na punktowane, dopisuje link końcowy i liczy czas czytania.
  Wszystko inne (struktura, długość, FAQ, linki, źródła, uczciwość) odrzuca szkic; powody trafiają do modelu w kolejnym
  szkicu (max 3 szkice na temat, max 2 tematy na przebieg). Za krótkie artykuły bot najpierw rozbudowuje sekcja po sekcji
  (limit 4000 tokenów odpowiedzi w GitHub Models).
- **D5 – Źródła tylko z listy.** Plan zawiera rejestr oficjalnych źródeł (pomoc platform, Google Search Central,
  EUR-Lex, ISAP, UOKiK, biznes.gov.pl). Jedyne dozwolone linki zewnętrzne w artykule to adresy z tego rejestru, a każda
  liczba lub zasada platformy musi mieć link do źródła tej platformy w tej samej sekcji (procent – w tym samym akapicie).
  Strona pomocy Amazon G1881 wymaga logowania, dlatego dla Amazon cytujemy publiczne wpisy pracowników Amazon na
  Seller Forums.
- **D6 – Zasady platform w briefie i w bramkach:** Vinted – tylko własne, nieedytowane zdjęcia (bez AI i scen
  generowanych); eBay – bez dodanych napisów, ramek i znaków wodnych; Amazon – zdjęcie główne na czystej bieli, produkt
  ≥ 85% kadru. AllGrafika nie łączy się z platformami i niczego nie publikuje; nowe konto ma 5 darmowych grafik.

## 4. Przepływ (workflow)

1. `blog_plan.py --validate` (błąd = koniec przebiegu) i podgląd 5 następnych tematów w podsumowaniu.
2. Generator: wybór tematu → brief typu → szkic → naprawy kodem → bramki → (odrzucenie z powodami → kolejny szkic).
3. `check_blog_duplicates.py`, `npm run lint`, `npm run format:check`, `npm run build` (prerender), sprawdzenie strony wpisu.
4. Commit na `main` (wpis, sitemap, dziennik), oczekiwanie na stronę online.
5. Krok „Run summary” (`if: always()`) – tabela wyników kroków i powody porażki.

`workflow_dispatch` z `dry_run` uruchamia to samo na przykładowym artykule, bez API i bez publikacji. Nie są potrzebne
nowe sekrety: `GITHUB_TOKEN` (GitHub Models) i opcjonalnie istniejący `OPENAI_API_KEY`.

## 5. Wymagania funkcjonalne

- **FR-BOT-001** – Plan tematów oparty na zbadanych zapytaniach z dowodem, w klastrach e-commerce.
- **FR-BOT-002** – Wybór tematu z rotacją klastrów i typów, oknami sezonowymi i przewodnikami filarowymi.
- **FR-BOT-003** – Bramki jakości z naprawą kodem i ponownym szkicem z uzasadnieniem.
- **FR-BOT-004** – Widoczny wynik każdego przebiegu w podsumowaniu GitHub Actions.

## 6. Kryteria akceptacji

- **AC-BOT-001** – Given zatwierdzony plan tematów, When `blog_plan.py --validate`, Then każdy wpis ma frazę, znany klaster, intencję, typ, priorytet 1–3, kąt, dowód i min. 2 linki do istniejących stron (bezpośrednio albo przez jedno 301), źródła są z rejestru, każdy klaster ma min. 4 wpisy, każdy typ występuje, plan nie wspomina Allegro ani fraz stron docelowych i walidacja kończy się kodem 0; plan z błędem kończy się kodem 1 z opisem problemu.
- **AC-BOT-002** – Given plan i dziennik, When symulujemy 30 kolejnych publikacji, Then żaden klaster nie występuje dwa razy z rzędu, typ artykułu nie powtarza się dwa razy z rzędu, przewodnik filarowy pojawia się nie rzadziej niż co 7 wpisów (dopóki są w planie; reguła klastra może go przesunąć o jeden wpis), a publikacje wypadają w poniedziałki, środy i piątki.
- **AC-BOT-003** – Given temat sezonowy, When bot wybiera temat, Then temat jest brany tylko między 42 a 21 dniem przed wydarzeniem (Black Friday 2026 = 27.11.2026, następny dzień publikacji po 2026-10-17 wybiera „black friday 2026”), a poza oknem jest pomijany i czeka na kolejny rok/okno.
- **AC-BOT-004** – Given dwuwyrazowa fraza ogólna (np. „fotografia produktowa”), When istnieje tylko węższy wpis z tymi słowami w tytule, Then fraza nie jest uznana za pokrytą; fraza w pełni pokryta przez istniejący tytuł nadal jest pomijana (AC-SEO-006).
- **AC-BOT-005** – Given szkic, When bramki jakości go sprawdzą, Then odrzucają go za długość poniżej minimum typu, za mało H2/H3, brak sekcji „Najczęstsze pytania” z wymaganą liczbą pytań z odpowiedzią, nagłówek H1, tabelę Markdown, instrukcję bez kroków „### Krok N” i tekst sezonowy bez harmonogramu, a przykładowy artykuł z dry runu przechodzi wszystkie bramki jako `guide` i nie przechodzi jako `pillar`.
- **AC-BOT-006** – Given linki w szkicu, When bramki je sprawdzą, Then link do nieistniejącego wpisu, link zewnętrzny spoza rejestru źródeł, za mało linków wewnętrznych (2, pillar 4) i brak linku do żadnej z zaplanowanych stron odrzucają szkic, a link do wpisu połączonego 301 jest przepisany kodem na wpis docelowy.
- **AC-BOT-007** – Given tytuł dłuższy niż 60 znaków albo opis meta dłuższy niż 158, When generator przygotowuje wpis, Then skraca je kodem na granicy słowa (bez wiszącego spójnika) zamiast odrzucać szkic; tytuł krótszy niż 30 znaków jest odrzucany.
- **AC-BOT-008** – Given szkic z procentowym wzrostem sprzedaży, procentem bez źródła w akapicie, „badania pokazują”, proporcją „3 na 4 klientów” albo case study „nasz klient”, When bramki go sprawdzą, Then szkic jest odrzucony; procent z linkiem do oficjalnego źródła w akapicie i plakietka rabatowa „-20%” są dozwolone.
- **AC-BOT-009** – Given zasada lub liczba dotycząca platformy, When w tej sekcji nie ma linku do oficjalnego źródła tej platformy, Then szkic jest odrzucony; odrzucone są też polecanie zdjęć z AI na Vinted, znaków wodnych/napisów na eBay i scen na zdjęciu głównym Amazon.
- **AC-BOT-010** – Given szkic, When krytykuje inne narzędzie, obiecuje „najlepsze”/„gwarantujemy”, twierdzi, że AllGrafika publikuje oferty lub łączy się z platformą, ma własny model AI albo daje inną liczbę darmowych grafik niż 5, albo nie ma żadnego CTA do AllGrafika, Then szkic jest odrzucony z powodem.
- **AC-BOT-011** – Given dostawca AI zwraca najpierw szkic ze zmyśloną liczbą, When bot pracuje online, Then odrzuca szkic, wysyła powody w kolejnym zapytaniu, akceptuje poprawiony szkic, zapisuje wpis, dopisuje do dziennika frazę ze slugiem, klastrem i typem, ustawia wyjście `slug` i zapisuje w podsumowaniu temat, powód odrzucenia i wynik.
- **AC-BOT-012** – Given workflow bloga, When go czytamy, Then uruchamia się w pon/śr/pt o 06:00 UTC (zgodnie z `PUBLISH_WEEKDAYS`), ma ręczny dry run, waliduje plan, sprawdza duplikaty, lint, format i build przed publikacją, publikuje tylko wpis z niepustym slugiem poza dry runem, zawsze zapisuje podsumowanie i używa wyłącznie sekretów `GITHUB_TOKEN` i `OPENAI_API_KEY`.
- **AC-BOT-013** – Given wszystkie tematy planu są wykorzystane, When bot startuje, Then nie pisze artykułu, nie woła API, kończy się kodem 0 i zostawia ostrzeżenie „Brak artykułu dziś” w podsumowaniu.

## 7. API

Brak zmian w API aplikacji.

## 8. Dane i migracje

`blog-keywords.json` ma wersję 2 (`clusters`, `sources`, `entries`). Wpisy dziennika `blog-keywords-used.json` dostały
pola `cluster` i `type` (istniejące wpisy uzupełnione ręcznie 2026-10-17); stare wpisy bez tych pól są obsługiwane
przez dopasowanie frazy do planu.

## 9. Wymagania niefunkcjonalne

- Koszt: do 3 szkiców + do 8 rozbudów sekcji + 2 poprawki pól na przebieg; 3 przebiegi tygodniowo mieszczą się w
  limitach GitHub Models; OpenAI (jeśli sekret istnieje) dostaje do 16k tokenów odpowiedzi dla przewodników.
- Prawo konsumenckie / UOKiK: zakaz zmyślonych wyników, case studies i superlatyw; zasady platform tylko ze źródłem.
- ISO 27001: bot nie czyta plików `.env`, nie loguje kluczy; testy używają lokalnego fałszywego endpointu.

## 10. Wpływ na dokumenty

README i inne specyfikacje bez zmian; `docs/specs/README.md` warto uzupełnić o wiersz 23 (poza zakresem tej zmiany).

## 11. Ryzyka i pytania otwarte

- Heurystyki bramek (fakty o platformach, krytyka konkurencji) mogą odrzucić poprawne zdanie – model dostaje powód
  i poprawia; jeśli trzy szkice nie przejdą, przebieg kończy się błędem bez publikacji (widoczne w podsumowaniu).
- Plan wymaga rozszerzenia po ok. 5 miesiącach i nowych tematów sezonowych co roku; tematy „Wielkanoc” i „Dzień Matki”
  mają słaby dowód popytu po stronie sprzedawców (priorytet 3).
- Strony pomocy platform mogą się zmienić – rejestr źródeł trzeba przejrzeć raz na kwartał.

## 12. Plan testów

Wszystkie AC: `landing-page/e2e/blog-bot.spec.ts` (Playwright, projekt `desktop-chrome`, uruchamiane w CI w jobie
„Landing page – hydration, budgets & demo”): skrypty Pythona wywoływane przez CLI (`blog_plan.py`, `blog_quality.py`,
`generate-blog-post.py` w dry runie i z lokalnym fałszywym endpointem OpenAI – bez prawdziwego API).
