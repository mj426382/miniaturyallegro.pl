# 01 – Wymagania funkcjonalne i niefunkcjonalne

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |

Wymagania funkcjonalne (FR) są rozwinięte w specyfikacjach obszarów 02–10. Tu jest ich rejestr i
wymagania przekrojowe (NFR). Sposób weryfikacji: **T** = test automatyczny z AC, **M** = pomiar
(Lighthouse, logi), **R** = review.

## Rejestr FR (skrót)

| ID | Wymaganie | Spec |
|---|---|---|
| FR-AUTH-001 | Rejestracja e-mail+hasło z akceptacją regulaminu; logowanie; Google; reset i zmiana hasła; usunięcie konta | 03 |
| FR-UPL-001 | Przesyłanie zdjęć pojedynczo i masowo z walidacją typu, rozmiaru i zawartości | 04 |
| FR-GEN-001 | Generowanie grafik w stylach, własny styl, przeróbka, ponowienie, ocena | 05 |
| FR-EXP-001 | Eksport w formatach Allegro z kadrem, obrotem, korektą i plakietką; pobieranie na telefonach | 06 |
| FR-DESC-001 | Opis oferty pod SEO z poprawkami AI i edycją ręczną | 07 |
| FR-ALG-001 | Połączenie konta Allegro, import zdjęć z ofert, publikacja grafik | 08 |
| FR-PAY-001 | Pakiety kredytów i abonamenty przez Stripe, zgodnie z prawem konsumenckim | 09 |
| FR-SEO-001 | Landing SSG z blogiem, cennikiem, demo i stabilnymi adresami | 10 |
| FR-ADM-001 | Panel operatora (przegląd, statystyki ocen, wyliczenie odstąpienia) dla `ADMIN_EMAILS` | 05 |

## Wymagania niefunkcjonalne

### Bezpieczeństwo (NFR-SEC)

| ID | Wymaganie | Weryfikacja |
|---|---|---|
| NFR-SEC-001 | Sesja w cookie httpOnly; żądania z cookie wymagają nagłówka `X-Requested-With` (CSRF); JWT unieważniane po zmianie/resetcie hasła | T: AC-AUTH-006/008/010 |
| NFR-SEC-002 | Rate limiting logowania i generowania; webhook Stripe i polling wyników bez limitu | T: AC-SEC-001 |
| NFR-SEC-003 | Każdy zasób sprawdzany pod kątem właściciela (403 dla cudzych zdjęć, grafik, opisów) | T: AC-SEC-002, AC-UPL-004, AC-DESC-005 |
| NFR-SEC-004 | Walidacja wejścia: whitelist DTO, magic bytes obrazów, limity rozmiaru, sanitizacja HTML opisów | T: AC-API-002, AC-UPL-002, AC-DESC-006 |
| NFR-SEC-005 | Konfiguracja produkcyjna walidowana przy starcie (sekrety ≥ 32 znaki, https, klucze AI, SMTP) | T: AC-SEC-004..007 |
| NFR-SEC-006 | Tokeny Allegro szyfrowane AES-256-GCM; hasła bcrypt | T: AC-ALG-005/006, AC-SEC-003 |
| NFR-SEC-007 | Helmet/CSP w produkcji, Swagger wyłączony w produkcji, brak sekretów w repo | R |

### Prywatność i prawo (NFR-LAW)

| ID | Wymaganie | Weryfikacja |
|---|---|---|
| NFR-LAW-001 | Akceptacja regulaminu zapisana z datą; regulamin i polityka identyczne w aplikacji i na landingu | T: AC-AUTH-001; R: `diff` kopii |
| NFR-LAW-002 | Prawo odstąpienia (art. 38 pkt 13, art. 35 u.p.k.) – zgody zbierane przed zakupem | T: AC-PAY-002/011 |
| NFR-LAW-003 | Prawo do usunięcia danych: konto, pliki, abonament; retencja demo 30 dni | T: AC-AUTH-015, AC-PAY-010, AC-DEMO-003 |
| NFR-LAW-004 | Opisy AI nie mogą zawierać zmyślonych parametrów ani zakazanych treści (linki, kontakt) – prompt + sanitizacja + ostrzeżenie dla użytkownika | T: AC-DESC-006; R prompt |

### Wydajność i koszty (NFR-PERF)

| ID | Wymaganie | Weryfikacja |
|---|---|---|
| NFR-PERF-001 | Landing: Lighthouse mobile perf ≥ 90, SEO = 100, LCP ≤ 2,5 s na stronie głównej, blogu i wpisie | M (ostatni pomiar: 99 / 98 / 93) |
| NFR-PERF-002 | Hydratacja bez błędów React na każdej trasie landingu | T: AC-SEO-001 |
| NFR-PERF-003 | Generacja jednej grafiki ≤ 60 s p95; status widoczny w UI bez odświeżania (polling ≤ 4 s) | M: logi; T: AC-GEN-021 |
| NFR-PERF-004 | Koszt AI na kredyt ≤ 0,20 zł; współbieżność Gemini ograniczona semaforem (`GEMINI_MAX_CONCURRENT`) | M; T: AC-GEN-019 |
| NFR-PERF-005 | Kredyty rozliczane atomowo (blokada wiersza), limit 30 generacji w toku na użytkownika | T: AC-GEN-004/006 |

### Niezawodność (NFR-REL)

| ID | Wymaganie | Weryfikacja |
|---|---|---|
| NFR-REL-001 | Nieudana generacja zwraca kredyt; zawieszone generacje sprząta reconciler (20 min / co 5 min) | T: AC-GEN-007/011 |
| NFR-REL-002 | Webhooki Stripe idempotentne, odporne na kolejność i livemode | T: AC-PAY-004/008/009 |
| NFR-REL-003 | Migracje uruchamiane przy starcie kontenera, zgodne wstecz z danymi produkcyjnymi | R: `scripts/migrate.js` |
| NFR-REL-004 | Healthcheck `GET /api/health` | T: AC-API-003 |

### Dostępność i UX (NFR-A11Y, NFR-UX)

| ID | Wymaganie | Weryfikacja |
|---|---|---|
| NFR-A11Y-001 | WCAG 2.1 AA: brak naruszeń serious/critical (axe) na każdym ekranie i w modalach | T: AC-UI-001/002 |
| NFR-A11Y-002 | Etykiety pól, nazwy przycisków-ikon, widoczny fokus, `aria-live` dla walidacji | T: AC-UI-001; R |
| NFR-UX-001 | Każdy ekran działa na 360 px; pobieranie na iPhone/Android przez arkusz udostępniania | T: AC-EXP-010/011, AC-UI-004 |
| NFR-UX-002 | Stany błędu API z „Spróbuj ponownie”, nigdy mylone ze stanem pustym | T: AC-UI-006 |
| NFR-UX-003 | Akcje destrukcyjne za potwierdzeniem; błąd renderu pokazuje ekran awaryjny | T: AC-UPL-015/017; R |

### Utrzymanie (NFR-DEV)

| ID | Wymaganie | Weryfikacja |
|---|---|---|
| NFR-DEV-001 | Każde AC ma test; `scripts/check-spec-coverage.js` zielony w CI | CI job `specs` |
| NFR-DEV-002 | Kontrakt OpenAPI wersjonowany i zgodny z kodem | T: AC-API-001 |
| NFR-DEV-003 | CI: backend unit+e2e, frontend lint+unit+Playwright (4 profile)+axe, landing build+hydratacja | CI |
| NFR-DEV-004 | Test z prawdziwym Gemini/OpenAI uruchamiany opt-in (`npm run test:live`) | T: AC-GEN-020 |
| NFR-DEV-005 | Zależności produkcyjne bez podatności wysokich/krytycznych w zależnościach bezpośrednich; `npm audit --omit=dev` w przeglądzie co miesiąc | R |
| NFR-DEV-006 | Formatowanie (Prettier) i lint (ESLint z `react`, `jsx-a11y`) wymuszone w CI; wersja Node z `.nvmrc`/`engines` | CI |
| NFR-REL-005 | Każde żądanie ma `x-request-id`; błędy 5xx logowane z kontekstem i raportowane do Sentry, gdy skonfigurowane | T: AC-SEC-008; R |

## Kryteria akceptacji (przekrojowe)

- **AC-SEC-001** – Given wiele prób logowania z jednego adresu, When przekroczony limit, Then 429; webhook Stripe i odpytywanie wyników generacji nigdy nie są ograniczane.
- **AC-SEC-002** – Given grafika innego użytkownika, When pobieranie, eksport lub ponowienie, Then 403.
- **AC-SEC-003** – Given funkcja skrótu tokenów resetu, When ten sam token jest haszowany dwa razy, Then wynik jest identyczny (deterministyczny).
- **AC-SEC-004** – Given `NODE_ENV=production`, When brakuje kluczy AI lub `FRONTEND_URL` nie jest https, Then aplikacja odmawia startu; poza produkcją te wartości są opcjonalne.
- **AC-SEC-005** – Given dowolne środowisko, When brakuje `DATABASE_URL` lub `JWT_SECRET`, Then aplikacja odmawia startu.
- **AC-SEC-006** – Given `FREE_CREDITS_LIMIT`, When nie jest nieujemną liczbą całkowitą, Then walidacja konfiguracji zgłasza błąd.
- **AC-SEC-007** – Given zmienne listowe i logiczne (np. `ADMIN_EMAILS`, `TRUST_PROXY`), When parsowane, Then listy są dzielone po przecinku, a wartości logiczne akceptują `true/false/1/0`.
- **AC-SEC-008** – Given dowolne żądanie, When obsłużone, Then odpowiedź ma nagłówek `x-request-id` (przekazany z żądania albo wygenerowany UUID), a odpowiedzi błędów zawierają `requestId` i nigdy nie zdradzają stosu ani ścieżek plików.
