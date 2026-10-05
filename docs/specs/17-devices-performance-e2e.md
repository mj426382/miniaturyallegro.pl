# 17 – Urządzenia, wydajność i test end-to-end na prawdziwym backendzie

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-05 |
| Powiązane | NFR-PERF-001, NFR-PERF-006, NFR-UX-001, NFR-UX-004, NFR-DEV-003, NFR-DEV-007, spec 10, spec 11 |

## 1. Kontekst

Aplikacja i landing działają na produkcji, a landing buduje pozycje w Google. Audyt z 2026-10-05 wykazał:

- Testy przeglądarkowe nie obejmowały tabletów, a landing nie był sprawdzany na Androidzie.
- Wszystkie testy UI działały na atrapie API. Nie było testu całej ścieżki rejestracja → potwierdzenie
  e-maila → zdjęcie → grafika na prawdziwym backendzie i bazie.
- Lighthouse mobile strony głównej wynosił 84–86 (budżet: ≥ 90). Główne przyczyny:
  - axios w głównym pakiecie landingu (158 KB),
  - treść regulaminu i polityki w głównym pakiecie (~49 KB),
  - favicon.ico ważący 370 KB,
  - aplikacja ładowana jednym pakietem 616 KB.
- Drobne usterki UX:
  - błędna odmiana („1 przesłanych zdjęć”),
  - tabela adminów nieczytelna na telefonie,
  - brak informacji o potwierdzeniu e-maila przy rejestracji,
  - rozciągnięte karty statystyk na tablecie.

## 2. Decyzje

- **Macierz urządzeń.** W aplikacji (Playwright) testujemy na:
  - Desktop Chrome i Desktop Safari,
  - iPhone 14 i Pixel 7,
  - iPad (gen 7), WebKit, 810 px w pionie,
  - Galaxy Tab S4, Chromium, Android.

  Landing (hydratacja i budżety) testujemy na Desktop Chrome, iPhone 14, Pixel 7 i iPad (gen 7).
- **Budżety pakietów** (gzip, sprawdzane testem na wyniku buildu):

  | Co | Limit |
  |---|---|
  | JS potrzebny do strony głównej landingu (wejściowy + modulepreload) | ≤ 110 KB |
  | Wejściowy JS aplikacji | ≤ 150 KB |
  | Pojedynczy chunk aplikacji | ≤ 120 KB |
  | `favicon.ico` | ≤ 16 KB |
  | `logo.webp` | ≤ 12 KB |

  `logo.png` i `og-image.png` zostają bez zmian (JSON-LD, Open Graph).
- **Landing bez axios.** Demo używa `fetch`.
- **Treść prawna ładowana leniwie**, ale prerenderowana w pełni. HTML regulaminu i polityki zawiera cały
  tekst, ważny dla SEO i dowodu treści. Klient doczytuje chunk przed hydratacją, tak samo jak wpisy bloga.
- **Trasy aplikacji dzielone** przez `React.lazy`. Ekrany logowania i rejestracji pozostają lekkie.
- **Test full-stack** uruchamia prawdziwy backend Nest z bazą testową (osobna baza, nigdy produkcyjna).
  Podmienione są tylko dostawcy zewnętrzni:
  - AI zastępuje deterministyczna atrapa,
  - poczta trafia do skrzynki w pamięci, odczytywanej przez lokalny endpoint testowy.

  Kod atrapy leży wyłącznie w `backend/test/` i nie trafia do obrazu produkcyjnego. Skrypt odmawia
  startu przy `NODE_ENV=production` albo przy bazie bez „test” w nazwie.
- **Odmiana liczebników** przez jedną funkcję `plural(n, one, few, many)`, zgodnie z regułami języka polskiego.

## 3. Kryteria akceptacji

- **AC-RWD-001** – Given każdy profil urządzenia (telefony, tablety, desktop), When otwarty jest dowolny główny ekran aplikacji (dashboard, przesyłanie, galeria, konto, cennik, admin), Then strona nie przewija się w poziomie, a nagłówek `<h1>` jest widoczny.
- **AC-RWD-002** – Given tablet w pionie, When otwarty dashboard z ostatnimi zdjęciami, Then karty statystyk nie są wyższe niż 160 px, a przycisk „Zobacz warianty” mieści się w jednej linii.
- **AC-RWD-003** – Given administrator na telefonie, When otworzy listę użytkowników, Then każdy użytkownik jest kartą z e-mailem, planem i liczbą grafik, a kliknięcie otwiera szczegóły (bez tabeli przewijanej w poziomie).
- **AC-RWD-004** – Given landing na Pixel 7 i iPad, When otwarte są `/`, `/blog`, wpis i `/regulamin`, Then hydratacja przebiega bez błędów, a strona nie przewija się w poziomie.
- **AC-UX-001** – Given liczba n, When funkcja `plural` dobiera formę, Then zwraca „1 zdjęcie”, „2–4 zdjęcia”, „5–21 zdjęć”, „22 zdjęcia”, „12–14 zdjęć”, „0 zdjęć”, a galeria z jednym zdjęciem pokazuje „1 przesłane zdjęcie”.
- **AC-UX-002** – Given strona rejestracji, When otwarta, Then podtytuł informuje, że 10 darmowych grafik odblokowuje potwierdzenie adresu e-mail.
- **AC-PERF-001** – Given build produkcyjny landingu, When zsumowany jest JS ładowany przez stronę główną, Then jest ≤ 110 KB gzip, a żaden plik nie zawiera axios.
- **AC-PERF-002** – Given prerenderowane `/regulamin` i `/polityka-prywatnosci`, When pobrany HTML, Then zawiera pełną treść dokumentu (np. ostatni paragraf), a w przeglądarce hydratacja przebiega bez błędów mimo leniwego chunku treści.
- **AC-PERF-003** – Given build produkcyjny aplikacji, When zmierzone są pakiety, Then wejściowy JS ≤ 150 KB gzip, każdy chunk ≤ 120 KB gzip, a ekrany za logowaniem są w osobnych chunkach.
- **AC-PERF-004** – Given pliki statyczne landingu i aplikacji, When zmierzone, Then `favicon.ico` ≤ 16 KB, `logo.webp` ≤ 12 KB, a `logo.png` i `og-image.png` istnieją.
- **AC-PERF-005** – Given demo na stronie głównej, When użytkownik wyśle poprawny formularz, Then żądanie `POST /api/demo` ma `multipart/form-data` z polami e-mail, zgodą i plikiem, a wynik demo wyświetla grafikę (bez axios).
- **AC-E2E-001** – Given prawdziwy backend z bazą testową i atrapą AI, When nowy użytkownik zarejestruje się w przeglądarce, kliknie link z e-maila, prześle zdjęcie i wygeneruje grafiki, Then widzi gotowe grafiki w galerii, a saldo kredytów spada o ich liczbę.
- **AC-E2E-002** – Given skrypt serwera testowego, When uruchomiony z `NODE_ENV=production` albo z bazą bez „test” w nazwie, Then odmawia startu.
- **AC-E2E-003** – Given prawdziwy backend, When niezweryfikowany użytkownik spróbuje generować, Then widzi komunikat o potwierdzeniu e-maila, nie powstaje żadna grafika i saldo się nie zmienia, a po kliknięciu linku z e-maila to samo generowanie się udaje.
