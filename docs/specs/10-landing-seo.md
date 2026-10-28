# 10 – Landing page, SEO i demo

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 (zmiany 2026-10-17: rezygnacja z Allegro; pozycjonowanie e-commerce ogólnie; 2026-10-18: ceny abonamentów, dokumenty prawne, zgoda w demo) |
| Powiązane | FR-SEO-001, NFR-PERF-001/002, ADR-0005, `landing-page/vercel.json`, `scripts/check-redirects.js`, `docs/seo/2026-10-ecommerce-seo-audit.md` |

## 1. Decyzje

- Landing to SSG: Vite SSR + prerender każdej trasy (strona główna, blog, wpisy, regulamin, polityka,
  404) z pełnym `<head>` per trasa (react-helmet-async). Treści wpisów ładowane leniwie na kliencie.
- Adresy bloga są wieczne: usunięcie/zmiana sluga wymaga 301 w `vercel.json`; build odmawia bez
  przekierowania. Codzienny bot bloga tworzy PR z walidacją (slug, kategoria, brak nieudokumentowanych %).
- Vercel serwuje `dist/<trasa>/index.html` bez rewrite SPA; nieznane adresy dają 404. `vite preview`
  robi to samo (plugin), więc testy hydratacji i Lighthouse mierzą to, co produkcja.
- Budżety: Lighthouse mobile perf ≥ 90, SEO 100; fonty nieblokujące; obrazy WebP.
- Decyzja właściciela 2026-10-17: narzędzie nie obsługuje już Allegro. Grupa docelowa to sprzedawcy na OLX, Vinted,
  eBay, Amazon i we własnych sklepach internetowych. Strona, blog, bot bloga i dokumenty prawne nie wspominają
  Allegro; stare adresy (wpisy i strona docelowa) mają 301 na następców (rewrite pod nowy slug albo połączenie
  z najbliższym wpisem). Nie obiecujemy integracji z platformami (brak publikacji i łączenia kont) – tylko eksport
  pod platformę i opisy dopasowane do platformy. Nazwy platform podajemy z neutralną notą o znakach towarowych.
- Słowa kluczowe: frazy z intencją „narzędzie” (zdjęcia AI do ofert, generator zdjęć produktowych AI, zdjęcia do
  ogłoszeń OLX/Vinted/eBay/Amazon, białe tło online/aplikacja) mają własne strony docelowe z demo (cenę zdjęć
  produktowych obsługuje istniejący wpis o kosztach); frazy poradnikowe (wymiary i wymagania zdjęć na platformach,
  zdjęcia telefonem) obsługuje blog.
- Pozycjonowanie 2026-10-17 (audyt `docs/seo/2026-10-ecommerce-seo-audit.md`): strona główna celuje w e-commerce
  ogólnie – „zdjęcia produktowe AI dla sklepów internetowych i marketplace’ów” – a nie w listę platform. Klastry
  e-commerce mają strony filarowe: generator zdjęć produktowych AI (`/zdjecia-ai-do-ofert`), fotografia produktowa AI
  (`/fotografia-produktowa-ai`), packshot (`/packshot-online`), białe tło (`/biale-tlo-zdjecie-produktu`), zdjęcia do
  sklepu internetowego (`/zdjecia-produktowe-do-sklepu-internetowego`) oraz strony platform (OLX, Vinted, eBay, Amazon).
  Osobnych stron per platforma sklepowa (Shopify, WooCommerce, Shoper, PrestaShop) nie tworzymy – brak popytu w PL
  i ryzyko cienkich stron; ich oficjalne dane są sekcją strony o sklepie internetowym.
- Strony docelowe mają unikalną treść (bez powielonych akapitów), datę aktualizacji, listę źródeł dla faktów
  o platformach (tylko oficjalna pomoc/dokumentacja), FAQ, CTA, linki do wpisów i do innych stron docelowych.
  Treść stron docelowych to osobne chunki JS ładowane leniwie (jak wpisy) – wspólny bundle zawiera tylko metadane.
- Blog jest podzielony na klastry tematyczne (hub na `/blog` z linkiem do strony filarowej klastra). Wpis z klastra
  linkuje stronę filarową i wpisy z tego samego klastra; wpis spoza klastra (np. nowy wpis bota) trafia do sekcji
  „Pozostałe poradniki”. Linki wewnętrzne w treści wpisów otwierają się w tej samej karcie.
- Dane strukturalne tworzą graf z `@id` (Organization, WebSite, SoftwareApplication z `AggregateOffer`). Ceny na stronie
  i w JSON-LD pochodzą z jednego modułu zgodnego z `backend/src/payments/plans.ts` (test pilnuje zgodności). Nie
  publikujemy ocen, opinii ani statystyk, których nie mamy.
- Sitemapa ma jedno źródło (`scripts/generate-sitemap.js`); `lastmod` to data zmiany treści (strona główna – stała
  w kodzie aktualizowana przy zmianie treści, nie data buildu).
- Po każdym udanym wdrożeniu produkcyjnym adresy dodane, zmienione (`lastmod`) i usunięte z sitemapy są zgłaszane do
  IndexNow (Bing, Yandex, Seznam, Naver) – spec 26; klucz to plik `landing-page/public/<klucz>.txt` spoza sitemapy.
- CSS strony jest wstawiany inline w prerenderowanym HTML (brak blokującego arkusza), a strona używa fontów systemowych
  zamiast pobierać Inter z Google Fonts (w symulacji Lighthouse mobile font opóźniał FCP o ok. 1,5 s).
- Demo bez konta: e-mail + zdjęcie, 1 grafika; limity 1/e-mail, 2/IP/dzień, honeypot; wynik e-mailem;
  dane usuwane po 30 dniach. Opcjonalna zgoda marketingowa (od 2026-10-18): „Chcę otrzymywać od AllGrafika porady
  o zdjęciach produktowych i sprzedaży online oraz informacje o nowościach”. API nie wersjonuje treści zgody
  (zapisuje `marketingOk` i `createdAt`, a nieznane pola formularza odrzuca), więc zgody sprzed i po zmianie
  rozróżnia data utworzenia wiersza względem daty wdrożenia; wersja treści zgody w API to osobna zmiana backendu.
- Ceny abonamentów od 2026-10-18 (decyzja właściciela): Start 19 zł / mies. za 40 grafik (0,48 zł za grafikę),
  Pro 59 zł / mies. za 150 grafik (0,39 zł za grafikę). Abonament Pro jest najtańszą ceną za grafikę, więc pakiet
  200 kredytów jest opisywany jako najtańszy bez abonamentu.
- Dokumenty prawne (źródło: `landing-page/src/legal`, kopia w aplikacji przez `frontend/scripts/sync-legal.js`)
  mają notę o zmianie z 2026-10-18: obniżka cen abonamentów obowiązuje od publikacji; limity przesyłania i skrót
  adresu e-mail po usunięciu konta ograniczają użytkowników, więc obowiązują 14 dni po publikacji (1 listopada
  2026 r., regulamin § 2 ust. 4); usuwanie EXIF i znacznik AI obowiązują od publikacji. Funkcja nazywa się
  „masowe przesyłanie” (nie „paczka zdjęć”; „paczka ZIP” to pobieranie).
- Komunikacja pain-first, przykłady przed/po, cennik z „1 kredyt = 1 grafika, opis gratis”.
- Program partnerski (2026-10-19, spec 24): strona `/program-partnerski` to **opis programu dla partnerów, a nie
  regulamin konsumencki** (regulamin bez zmian). Indeksowalna, w sitemapie i w stopce (kolumna „Firma”), z tymi samymi
  zasadami head co strony docelowe (tytuł ≤ 60, opis, canonical, jedno H1, JSON-LD `WebPage` + `BreadcrumbList`, obraz OG),
  ale bez demo i bez FAQ. Liczby programu (10%, 20%, 12 miesięcy, 50 zł) pochodzą z jednego modułu danych landingu,
  zgodnego z domyślnymi wartościami backendu (test pilnuje zgodności).
- Darmowe narzędzie „Sprawdź zdjęcie produktu” (2026-10-19, spec 25): strona `/narzedzia/sprawdz-zdjecie-produktu`
  jest indeksowalna, w sitemapie, w stopce (kolumna „Produkt”), na stronie głównej i na stronach docelowych OLX, Vinted,
  eBay, Amazon, sklepu internetowego i białego tła. Ma te same zasady head co strony docelowe oraz JSON-LD
  `WebApplication` (darmowe, bez ocen), `BreadcrumbList` i `FAQPage`. Zdjęcia analizuje wyłącznie przeglądarka, a kod
  narzędzia jest leniwym chunkiem spoza pakietu strony głównej. Hubu `/narzedzia` nie tworzymy, dopóki jest jedno narzędzie.

## 2. Kryteria akceptacji

- **AC-SEO-001** – Given prerenderowana trasa (`/`, `/blog`, wpis, `/regulamin`, `/polityka-prywatnosci`), When otwarta w przeglądarce, Then hydratacja przebiega bez błędów ani ostrzeżeń React, a `<h1>` jest widoczne przed hydratacją.
- **AC-SEO-002** – Given wpis bloga, When pobrany HTML, Then tytuł, canonical i JSON-LD `Article` są poprawne dla tej trasy.
- **AC-SEO-003** – Given strona główna po hydratacji, When użytkownik wypełni e-mail w demo bez pliku i zgody, Then przycisk pozostaje nieaktywny (widget interaktywny).
- **AC-DEMO-001** – Given poprawny e-mail i zdjęcie, When demo, Then powstaje jedna grafika, wynik idzie e-mailem, a limity per e-mail i IP zwracają 429.
- **AC-DEMO-002** – Given wypełniony honeypot, zły e-mail lub plik nieobraz, When demo, Then 400.
- **AC-DEMO-003** – Given żądania demo starsze niż 30 dni, When sprzątanie, Then wiersze i pliki znikają.
- **AC-DEMO-004** – Given model tekstowy niedostępny (analiza zdjęcia lub prompt zawodzi), When demo, Then grafika powstaje z bazowego promptu stylu i wynik idzie e-mailem.
- **AC-SEO-004** – Given generator bloga uruchomiony w trybie testowym z przykładowym artykułem, When zakończy pracę, Then powstaje plik wpisu z poprawnym slugiem i linkiem końcowym, wpis pojawia się dokładnie raz w generowanym indeksie, a sitemapa zawiera jego adres.
- **AC-SEO-005** – Given wpis o tym samym slugu już istnieje, When generator uruchomi się ponownie, Then kończy pracę bez zmian z komunikatem o duplikacie.
- **AC-SEO-006** – Given wpis, którego temat (tytuł, slug, nagłówki – z uwzględnieniem polskiej odmiany) albo treść pokrywa się z istniejącym wpisem, When generator go przygotuje albo build sprawdzi bloga, Then wpis jest odrzucony (bot prosi model o inny temat), a fraza z planu już pokryta przez istniejący wpis jest pomijana bez pisania artykułu (kanibalizacja słów kluczowych).
- **AC-SEO-007** – Given strony docelowe `/zdjecia-ai-do-ofert`, `/fotografia-produktowa-ai`, `/packshot-online`, `/biale-tlo-zdjecie-produktu`, `/zdjecia-produktowe-do-sklepu-internetowego`, `/zdjecia-produktowe-olx`, `/zdjecia-produktowe-vinted`, `/zdjecia-produktowe-ebay` i `/zdjecia-produktowe-amazon`, When pobrany HTML, Then każda ma unikalny tytuł (≤ 60 znaków z dopiskiem), meta description 120–158 znaków, canonical na swój adres, jedno `<h1>` z frazą docelową (tekst nagłówka bez sklejonych słów), treść w prerenderowanym HTML, JSON-LD `WebPage`, `FAQPage` i `BreadcrumbList`, jest w sitemapie i podlinkowana ze stopki, a demo działa po hydratacji bez błędów.
- **AC-SEO-008** – Given strona główna, When pobrany HTML, Then tytuł (≤ 60 znaków) zaczyna się od „Zdjęcia produktowe AI” i zawiera „sklep”, meta description (≤ 158 znaków) wymienia sklep internetowy i marketplace, `<h1>` brzmi „Zdjęcia produktowe AI dla sklepów internetowych i marketplace’ów”, sekcja „Gdzie wykorzystasz zdjęcia” linkuje każdą stronę docelową, a pytania FAQ widoczne na stronie są tymi samymi pytaniami co w JSON-LD `FAQPage`; frazy zarezerwowane dla stron docelowych nie są celem wpisów bloga (bot je pomija).
- **AC-SEO-009** – Given dowolna prerenderowana trasa (wpis bloga, `/blog`, strona docelowa, regulamin, polityka, 404), When pobrany HTML, Then `<title>` ma ≤ 60 znaków: dopisek „ | AllGrafika.pl” jest doklejany tylko wtedy, gdy cały tytuł z dopiskiem mieści się w 60 znakach, w przeciwnym razie tytuł jest bez dopisku; tytuł każdego wpisu ma ≤ 60 znaków, a jego meta description ≤ 160 znaków.
- **AC-SEO-010** – Given wpis połączony z innym (cienkie/zduplikowane wpisy, np. dawne wpisy „miniaturka dla kategorii X” → poradnik `zdjecia-produktowe-dla-kategorii-poradnik`), When build, Then jego adres ma 301 w `vercel.json` na istniejący wpis (bez łańcuchów), nie ma go w indeksie bloga ani w sitemapie, a wpis docelowy zwraca stronę z jednym `<h1>`.
- **AC-SEO-011** – Given prerenderowana strona (`/`, `/blog`, każdy wpis, strony docelowe, regulamin, polityka, 404) oraz sitemapa, When pobrany HTML/XML, Then nie zawiera słowa „Allegro” (w treści, `<head>`, JSON-LD i linkach), stopka zawiera neutralną notę o znakach towarowych platform, a każdy dawny adres z „allegro” (wpisy, np. `/blog/wymiary-zdjec-allegro-rozmiary-piksele-waga-bledy`, i `/zdjecia-ai-allegro`) ma w `vercel.json` przekierowanie 301 na istniejącą stronę bez łańcucha.
- **AC-SEO-012** – Given generator bloga, When model zaproponuje artykuł, którego slug, tytuł, opis lub treść dotyczy Allegro, Then wpis jest odrzucony z komunikatem (bot prosi o inny temat), a plan słów kluczowych i prompty nie zawierają tematów Allegro.
- **AC-SEO-013** – Given regulamin i polityka prywatności (landing i kopia w aplikacji), When pobrane, Then są identyczne w obu pakietach, nie opisują integracji z platformą sprzedażową (łączenie kont, tokeny, publikacja), a regulamin zawiera notę o zmianie z datą 17 października 2026 r.
- **AC-SEO-014** – Given każda strona docelowa, When pobrany HTML, Then ma co najmniej 450 słów własnej treści (lead, sekcje, FAQ), żaden jej akapit sekcji nie występuje na innej stronie docelowej, pokazuje datę aktualizacji, każdy fakt o platformie ma źródło na liście „Źródła” (adresy oficjalnej pomocy lub dokumentacji), linkuje co najmniej 2 istniejące wpisy bloga i co najmniej 2 inne strony docelowe, a jej frazy docelowe nie pokrywają się z frazami innej strony docelowej.
- **AC-SEO-015** – Given dowolna prerenderowana trasa (`/`, `/blog`, wpis, strona docelowa), When pobrany HTML, Then każdy blok JSON-LD jest poprawnym JSON z `@context` `https://schema.org`; strona główna ma `Organization`, `WebSite`, `SoftwareApplication` z `AggregateOffer` (najniższa cena 0, najwyższa równa najdroższej ofercie) i `FAQPage`; `/blog` ma `Blog` z listą wpisów i `BreadcrumbList`; wpis ma `BlogPosting` (z datami i obrazem) i `BreadcrumbList`, a wpis z sekcją „Najczęstsze pytania” także `FAQPage` z pytaniami z treści; nie ma ocen (`aggregateRating`, `review`).
- **AC-SEO-016** – Given cennik na stronie głównej i oferty w JSON-LD, When porównane z `backend/src/payments/plans.ts`, Then pakiety (kredyty i cena) i abonamenty (kredyty i cena miesięczna) są identyczne, a liczba darmowych grafik równa się puli z cennika (spec 02).
- **AC-SEO-025** – Given wszystkie wpisy bloga, When pobrany HTML każdego wpisu, Then sekcja „Podobne wpisy” wybiera sąsiadów wpisu w jego klastrze rotacyjnie (następny, kolejny i poprzedni na liście klastra), a dopiero potem wpisy z tej samej kategorii, więc każdy wpis jest linkowany z sekcji „Podobne wpisy” co najmniej 3 innych wpisów (żaden wpis nie jest „sierotą” w linkowaniu wewnętrznym).
- **AC-SEO-037** – Given wpis opublikowany przez bota bloga (spec 23), którego nikt nie przypisał ręcznie do klastra w `topicClusters.ts`, When strona `/blog` i sekcja „Podobne wpisy” są budowane, Then wpis trafia na koniec klastra bloga wskazanego przez klaster planu (`blog-keywords-used.json` → mapowanie klastrów planu na klastry bloga, każdy z 8 klastrów planu ma klaster docelowy), więc nie ląduje w „Pozostałych poradnikach” i jest linkowany z co najmniej 3 wpisów (AC-SEO-025); wpis przypisany ręcznie zostaje tam, gdzie jest, a slug bez wpisu na blogu (np. scalony) jest pomijany.
- **AC-SEO-017** – Given `/blog` i wpisy, When pobrany HTML, Then `/blog` ma sekcję dla każdego klastra tematycznego z opisem i linkiem do strony filarowej, każdy wpis należy do co najwyżej jednego klastra i jest linkowany z `/blog`, wpis z klastra linkuje swoją stronę filarową i co najmniej 2 wpisy z tego samego klastra, a linki do allgrafika.pl w treści wpisów prowadzą do istniejących adresów i otwierają się w tej samej karcie (bez `target="_blank"`); listy w treści są poprawnymi listami `<ul>`/`<ol>`.
- **AC-SEO-018** – Given sitemapa i prerenderowane trasy, When porównane, Then każda indeksowalna trasa (strona główna, `/blog`, strony docelowe, wpisy) występuje w sitemapie dokładnie raz, sitemapa nie zawiera adresów z przekierowaniem ani `noindex`, `lastmod` strony głównej jest datą zmiany treści (nie datą buildu), `lastmod` wpisu równa się jego dacie modyfikacji, a `robots.txt` wskazuje sitemapę; nieznany adres zwraca 404 z `noindex`.
- **AC-SEO-019** – Given dowolna indeksowalna trasa (strona główna, `/blog`, strona docelowa, wpis), When pobrany HTML, Then `og:image` i `twitter:image` to bezwzględne adresy istniejących plików PNG 1200×630 z `og:image:width`, `og:image:height` i `og:image:alt`; strony docelowe i `/blog` mają własne obrazy OG; strona ma dokładnie jedno `<h1>`, poziomy nagłówków w treści nie przeskakują (np. H2 → H4), a każdy obraz ma niepusty `alt`.
- **AC-SEO-020** – Given wszystkie wpisy, When pobrany indeks bloga, Then tytuły wpisów są unikalne i mają ≤ 60 znaków, meta description ma 70–158 znaków i jest unikalny w obrębie serwisu, a żaden tytuł nie używa słowa „miniaturka”/„miniaturki” (dawne słownictwo Allegro).
- **AC-SEO-021** – Given prerenderowana trasa, When pobrany HTML, Then arkusz stylów strony jest wstawiony inline (`<style>`) zamiast blokującego `<link rel="stylesheet">` do własnego pliku CSS, strona nie pobiera fontów z zewnętrznych serwerów (np. Google Fonts), a treść strony docelowej jest w osobnym chunku JS, który nie trafia do wspólnego bundla strony głównej.
- **AC-SEO-022** – Given strona główna (cennik, FAQ), strony docelowe i JSON-LD, When pobrany HTML, Then abonament Start kosztuje 19 zł / mies. za 40 grafik (0,48 zł / grafikę), Pro 59 zł / mies. za 150 grafik (0,39 zł / grafikę), oferty `UnitPriceSpecification` w JSON-LD mają te ceny, FAQ podaje abonament od 0,39 zł za grafikę, nigdzie nie ma dawnych cen 49 zł i 149 zł, a pakiet 200 kredytów nie jest opisany jako najniższa cena za grafikę.
- **AC-SEO-023** – Given regulamin i polityka prywatności (landing i kopia w aplikacji), When pobrane, Then polityka ma sekcję o skrócie HMAC adresu e-mail po usunięciu konta (tylko skrót z datą usunięcia, bez adresu, 12 miesięcy, art. 6 ust. 1 lit. f RODO, cel: darmowa pula i nagrody za polecenia – zdanie uzgodnione z backendem), zdanie „Z przesłanych zdjęć usuwamy metadane (EXIF, w tym lokalizację GPS).” i o znaczniku IPTC/XMP `DigitalSourceType` w eksportowanych grafikach AI; regulamin i polityka podają limity przesyłania (5 zdjęć bez potwierdzonego adresu, 200 zdjęć na 24 godziny) obowiązujące od 1 listopada 2026 r.; regulamin podaje ceny abonamentów Start 19 zł i Pro 59 zł oraz notę o zmianie z 18 października 2026 r. (obniżka od publikacji, ograniczenia 14 dni po publikacji zgodnie z § 2 ust. 4), zachowując notę z 17 października; żaden dokument nie mówi o „paczce zdjęć”, a kopie w obu pakietach są identyczne.
- **AC-SEO-026** – Given regulamin (landing i kopia w aplikacji), When pobrany, Then § 4 ust. 12 „Kody rabatowe” mówi, że kod wpisuje się na stronie płatności Stripe, obniża cenę jednego zamówienia pakietu Kredytów (kod jednorazowy może obniżyć też pierwszą płatność abonamentu), można go użyć raz w danym zamówieniu, nie łączy się z pakietem powitalnym ani innym kodem, nie podlega wymianie na gotówkę ani Kredyty, za zamówienie z kodem przysługuje pełna liczba Kredytów, a przy odstąpieniu lub zwrocie podstawą jest cena faktycznie zapłacona (spec 09, AC-PAY-026..030); § 11 ma notę o tym uzupełnieniu z 18 października 2026 r. obowiązującym od publikacji (dodatkowa korzyść), a kopie w obu pakietach są identyczne.
- **AC-SEO-027** – Given `/program-partnerski`, When pobrany HTML i otwarta w przeglądarce, Then tytuł ma ≤ 60 znaków, meta description 120–158 znaków, canonical na swój adres, dokładnie jedno `<h1>`, JSON-LD `WebPage` i `BreadcrumbList`, własny obraz OG 1200×630, strona jest w sitemapie i podlinkowana ze stopki każdej strony; treść podaje 10% rabatu dla czytelników, 20% prowizji od opłaconych zakupów przez 12 miesięcy, rozliczenie miesięczne na podstawie faktury partnera, minimum 50 zł, zakazy (spam, licytowanie marki AllGrafika w reklamach, zakupy własne), wymóg `rel="sponsored"` albo `nofollow` dla płatnych linków i informację, że to opis programu, a nie regulamin dla klientów; CTA to `mailto:kontakt@allgrafika.pl`; liczby są równe domyślnym wartościom partnera w backendzie; hydratacja bez błędów i bez poziomego przewijania na telefonie.
- **AC-SEO-024** – Given formularz demo, When wyświetlony i wysłany, Then pole adresu ma etykietę „E-mail”, opcjonalna zgoda marketingowa mówi o „poradach o zdjęciach produktowych i sprzedaży online” (bez „miniaturek”), a formularz wysyła tylko pola znane API (`file`, `email`, `style`, `marketingOk`).
