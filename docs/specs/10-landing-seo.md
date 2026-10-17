# 10 – Landing page, SEO i demo

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 (zmiana 2026-10-17: rezygnacja z Allegro) |
| Powiązane | FR-SEO-001, NFR-PERF-001/002, ADR-0005, `landing-page/vercel.json`, `scripts/check-redirects.js` |

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
- **AC-SEO-007** – Given strony docelowe `/zdjecia-ai-do-ofert`, `/biale-tlo-zdjecie-produktu`, `/zdjecia-produktowe-olx`, `/zdjecia-produktowe-vinted`, `/zdjecia-produktowe-ebay` i `/zdjecia-produktowe-amazon`, When pobrany HTML, Then każda ma unikalny tytuł (≤ 60 znaków z dopiskiem), meta description 120–160 znaków, canonical na swój adres, jedno `<h1>` z frazą docelową, JSON-LD `FAQPage` i `BreadcrumbList`, jest w sitemapie i podlinkowana ze stopki, a demo działa po hydratacji bez błędów.
- **AC-SEO-008** – Given strona główna, When pobrany HTML, Then tytuł zawiera frazy „Zdjęcia produktowe”, „AI”, „OLX” i „Vinted” (≤ 60 znaków), a `<h1>` zawiera „Zdjęcia produktowe z AI”; frazy zarezerwowane dla stron docelowych nie są celem wpisów bloga (bot je pomija).
- **AC-SEO-009** – Given dowolna prerenderowana trasa (wpis bloga, `/blog`, strona docelowa, regulamin, polityka, 404), When pobrany HTML, Then `<title>` ma ≤ 60 znaków: dopisek „ | AllGrafika.pl” jest doklejany tylko wtedy, gdy cały tytuł z dopiskiem mieści się w 60 znakach, w przeciwnym razie tytuł jest bez dopisku; tytuł każdego wpisu ma ≤ 60 znaków, a jego meta description ≤ 160 znaków.
- **AC-SEO-010** – Given wpis połączony z innym (cienkie/zduplikowane wpisy, np. dawne wpisy „miniaturka dla kategorii X” → poradnik `zdjecia-produktowe-dla-kategorii-poradnik`), When build, Then jego adres ma 301 w `vercel.json` na istniejący wpis (bez łańcuchów), nie ma go w indeksie bloga ani w sitemapie, a wpis docelowy zwraca stronę z jednym `<h1>`.
- **AC-SEO-011** – Given prerenderowana strona (`/`, `/blog`, każdy wpis, strony docelowe, regulamin, polityka, 404) oraz sitemapa, When pobrany HTML/XML, Then nie zawiera słowa „Allegro” (w treści, `<head>`, JSON-LD i linkach), stopka zawiera neutralną notę o znakach towarowych platform, a każdy dawny adres z „allegro” (wpisy, np. `/blog/wymiary-zdjec-allegro-rozmiary-piksele-waga-bledy`, i `/zdjecia-ai-allegro`) ma w `vercel.json` przekierowanie 301 na istniejącą stronę bez łańcucha.
- **AC-SEO-012** – Given generator bloga, When model zaproponuje artykuł, którego slug, tytuł, opis lub treść dotyczy Allegro, Then wpis jest odrzucony z komunikatem (bot prosi o inny temat), a plan słów kluczowych i prompty nie zawierają tematów Allegro.
- **AC-SEO-013** – Given regulamin i polityka prywatności (landing i kopia w aplikacji), When pobrane, Then są identyczne w obu pakietach, nie opisują integracji z platformą sprzedażową (łączenie kont, tokeny, publikacja), a regulamin zawiera notę o zmianie z datą 17 października 2026 r.
