# 10 – Landing page, SEO i demo

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |
| Powiązane | FR-SEO-001, NFR-PERF-001/002, ADR-0005, `landing-page/vercel.json`, `scripts/check-redirects.js` |

## 1. Decyzje

- Landing to SSG: Vite SSR + prerender każdej trasy (strona główna, blog, wpisy, regulamin, polityka,
  404) z pełnym `<head>` per trasa (react-helmet-async). Treści wpisów ładowane leniwie na kliencie.
- Adresy bloga są wieczne: usunięcie/zmiana sluga wymaga 301 w `vercel.json`; build odmawia bez
  przekierowania. Codzienny bot bloga tworzy PR z walidacją (slug, kategoria, brak nieudokumentowanych %).
- Vercel serwuje `dist/<trasa>/index.html` bez rewrite SPA; nieznane adresy dają 404. `vite preview`
  robi to samo (plugin), więc testy hydratacji i Lighthouse mierzą to, co produkcja.
- Budżety: Lighthouse mobile perf ≥ 90, SEO 100; fonty nieblokujące; obrazy WebP.
- Słowa kluczowe (research podpowiedzi Google, 2026-10-09): frazy z intencją „narzędzie” (zdjęcia AI na Allegro,
  generator zdjęć produktowych AI, białe tło online/aplikacja) mają własne strony docelowe z demo (cenę zdjęć
  produktowych obsługuje istniejący wpis o kosztach – bez drugiej strony na to samo zapytanie); frazy poradnikowe (zasady i wymiary zdjęć Allegro, zdjęcia telefonem) obsługuje blog. „Obrazki/grafiki
  allegro” bez dopisku to w Google głównie kupujący (obrazki na ścianę, miniaturki perfum) – nie są celem.
- Demo bez konta: e-mail + zdjęcie, 1 grafika; limity 1/e-mail, 2/IP/dzień, honeypot; wynik e-mailem;
  dane usuwane po 30 dniach.
- Komunikacja pain-first, przykłady przed/po, cennik z „1 kredyt = 1 grafika, opis gratis”.

## 2. Kryteria akceptacji

- **AC-SEO-001** – Given prerenderowana trasa (`/`, `/blog`, wpis, `/regulamin`, `/polityka-prywatnosci`), When otwarta w przeglądarce, Then hydratacja przebiega bez błędów ani ostrzeżeń React, a `<h1>` jest widoczne przed hydratacją.
- **AC-SEO-002** – Given wpis bloga, When pobrany HTML, Then tytuł, canonical i JSON-LD `Article` są poprawne dla tej trasy.
- **AC-SEO-003** – Given strona główna po hydratacji, When użytkownik wypełni e-mail w demo bez pliku i zgody, Then przycisk pozostaje nieaktywny (widget interaktywny).
- **AC-DEMO-001** – Given poprawny e-mail i zdjęcie, When demo, Then powstaje jedna grafika, wynik idzie e-mailem, a limity per e-mail i IP zwracają 429.
- **AC-DEMO-002** – Given wypełniony honeypot, zły e-mail lub plik nieobraz, When demo, Then 400.
- **AC-DEMO-003** – Given żądania demo starsze niż 30 dni, When sprzątanie, Then wiersze i pliki znikają.
- **AC-SEO-004** – Given generator bloga uruchomiony w trybie testowym z przykładowym artykułem, When zakończy pracę, Then powstaje plik wpisu z poprawnym slugiem i linkiem końcowym, wpis pojawia się dokładnie raz w generowanym indeksie, a sitemapa zawiera jego adres.
- **AC-SEO-005** – Given wpis o tym samym slugu już istnieje, When generator uruchomi się ponownie, Then kończy pracę bez zmian z komunikatem o duplikacie.
- **AC-SEO-006** – Given wpis, którego temat (tytuł, slug, nagłówki – z uwzględnieniem polskiej odmiany) albo treść pokrywa się z istniejącym wpisem, When generator go przygotuje albo build sprawdzi bloga, Then wpis jest odrzucony (bot prosi model o inny temat), a fraza z planu już pokryta przez istniejący wpis jest pomijana bez pisania artykułu (kanibalizacja słów kluczowych).
- **AC-SEO-007** – Given strony docelowe `/zdjecia-ai-allegro` i `/biale-tlo-zdjecie-produktu`, When pobrany HTML, Then każda ma unikalny tytuł (≤ 60 znaków z dopiskiem), meta description 120–160 znaków, canonical na swój adres, jedno `<h1>` z frazą docelową, JSON-LD `FAQPage` i `BreadcrumbList`, jest w sitemapie i podlinkowana ze stopki, a demo działa po hydratacji bez błędów.
- **AC-SEO-008** – Given strona główna, When pobrany HTML, Then tytuł zawiera frazy „Grafiki”, „miniatury” i „zdjęcia Allegro” (≤ 60 znaków), a `<h1>` zawiera „Grafiki i miniaturki Allegro”; frazy zarezerwowane dla stron docelowych nie są celem wpisów bloga (bot je pomija).
