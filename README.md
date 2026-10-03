# AllGrafika.pl

SaaS do generowania miniaturek i grafik produktowych na Allegro z jednego zdjęcia produktu
(Google Gemini – obraz, OpenAI – analiza produktu i prompt engineering).

## Struktura

```
├── backend/        # NestJS API (TypeScript, Prisma, PostgreSQL, JWT, Stripe)
├── frontend/       # Aplikacja (React + Vite + Tailwind) – app.allgrafika.pl
├── landing-page/   # Strona marketingowa + blog, SSG (React + Vite) – allgrafika.pl
├── infra/          # docker-compose (prod / dev / test)
└── .github/        # CI (lint, testy, build) oraz generator wpisów na blog
```

## Jak to działa (model biznesowy)

| Element | Wartość | Gdzie konfigurować |
|---|---|---|
| Darmowe grafiki dla nowego konta | 10 | `FREE_CREDITS_LIMIT` (musi zgadzać się z regulaminem) |
| 1 kredyt | 1 grafika | – |
| Zestaw startowy (domyślny wybór) | 3 style: `white-bg`, `lifestyle-home`, `dark-luxury` | `DEFAULT_STYLE_IDS` |
| Wszystkie style automatyczne | 6 | `backend/src/generation/styles.ts` |
| Pakiety jednorazowe | 5 / 15 / 40 kredytów (10 / 28 / 70 zł) | `backend/src/payments/plans.ts` |
| Abonamenty | Start 49 zł = 40 grafik/mies., Pro 149 zł = 150 grafik/mies. | `plans.ts` + Stripe Price IDs w env (`STRIPE_PRICE_SUB_*`) |
| Demo bez konta | 1 próba / e-mail, 2 / IP / dzień, wynik mailem | `DEMO_ENABLED`, `LANDING_URL` |

Użytkownik sam wybiera style (checkboxy). Domyślnie zaznaczone są 3 style startowe, po pierwszej
partii aplikacja proponuje dogenerowanie pozostałych. Kredyt jest pobierany atomowo przy starcie;
nieudane generacje (błąd modelu, awaria serwera) są automatycznie zwracane, także po restarcie
(reconciliacja co 5 min). Opis produktu generowany jest raz na zdjęcie i cache'owany.

### Funkcje biznesowe

- **Demo bez konta** (`POST /api/demo`) – landing page pozwala wygenerować jedną grafikę po podaniu
  e-maila (lead), z honeypotem i limitami. Wynik wysyłany mailem z linkiem do rejestracji.
- **Przed / po** – sekcja na landing page renderowana z prawdziwych par w `landing-page/public/samples/`
  (instrukcja w README tego katalogu); bez plików sekcja jest ukryta.
- **Abonamenty Stripe Billing** – checkout w trybie `subscription`, kredyty dopisywane na `invoice.paid`
  (idempotentnie po id faktury), portal klienta do anulowania/zmiany planu.
- **Eksport** (`POST /api/generation/export/:id`) – formaty 1:1 / 4:3 / 3:4 / 16:9, rozmiar,
  JPEG/PNG/WebP, plakietka promocyjna (sharp, bez AI).
- **Integracja Allegro** (`/api/allegro/*`) – OAuth sprzedawcy, lista ofert, import zdjęcia głównego,
  publikacja grafiki jako zdjęcie główne / do galerii. Tokeny szyfrowane AES-256-GCM.
  Wymaga rejestracji aplikacji na apps.developer.allegro.pl i testu na sandboxie (`ALLEGRO_SANDBOX=true`).
- **Ocena jakości** (`POST /api/generation/feedback/:id`) – kciuk w górę/dół + powód; agregat
  `GenerationService.getFeedbackStats()` lub SQL: `SELECT style, rating, count(*) FROM generations WHERE rating IS NOT NULL GROUP BY 1,2`.
- **Analityka** – Plausible/Umami bez cookies; włączana zmiennymi `VITE_ANALYTICS_DOMAIN`
  (+ opcjonalnie `VITE_ANALYTICS_SRC`, `VITE_ANALYTICS_WEBSITE_ID`) w obu frontendach.
  Zdarzenia lejka: `demo_start`, `demo_done`, `register`, `upload`, `generation_start`, `export`, `feedback`, `purchase`, `allegro_*`.

## Szybki start

### Wymagania
- Node.js 20+ (CI używa 24), Docker (Postgres)
- Konto Backblaze B2, klucz Gemini API, klucz OpenAI API, Stripe (opcjonalnie), SMTP (opcjonalnie)

### Backend

```bash
cd backend
cp .env.example .env            # uzupełnij wartości
npm install
npx prisma migrate deploy        # migracje są wersjonowane w prisma/migrations
npm run start:dev                # http://localhost:3000, Swagger: /api/docs (tylko dev)
```

Bez skonfigurowanego B2 pliki trafiają na dysk (`LOCAL_UPLOAD_DIR`) i są serwowane pod `/api/uploads/...`;
ustaw wtedy `API_PUBLIC_URL` (np. `http://localhost:3000`), żeby frontend na innym porcie dostał absolutne
adresy obrazów. Bez SMTP e-maile (reset hasła) są logowane do konsoli. Logowanie Google działa lokalnie
tylko dla originów dodanych w konsoli Google Cloud.

### Frontend / landing

```bash
cd frontend && npm install && npm run dev        # http://localhost:5173
cd landing-page && npm install && npm run dev    # http://localhost:5174
```

Build landing page (`npm run build`) generuje sitemapę, buduje bundle kliencki i SSR, a następnie
prerenderuje statyczny HTML każdej trasy (`dist/blog/<slug>/index.html` itd.) – crawlery dostają
pełną treść i meta tagi bez JavaScriptu. OG image i favicony: `npm run og-image`.
`npm run preview` serwuje te pliki tak jak Vercel (`/blog` → `dist/blog/index.html`, nieznane adresy → 404) –
plugin w `vite.config.ts`; bez niego podgląd zwracałby stronę główną dla każdej trasy i hydratacja by się
wysypywała. Testy hydratacji i Lighthouse uruchamiaj właśnie przeciw `preview`.

### Eksport z edycją i opisy ofert

- **Eksport** (`POST /api/generation/export/:id`): formaty Allegro (1:1, 4:3, 16:9, 3:4), kadrowanie wybrane przez
  użytkownika (`crop` jako ułamki 0–1 obróconego obrazu, interaktywny kadrownik `react-easy-crop` w modalu),
  obrót o 90/180/270° (`rotate`), korekta jasności/kontrastu/nasycenia i wyostrzenie (`adjust`, podgląd CSS
  odpowiada operacjom sharp), plakietka promocyjna. Bez `crop` grafika jest dopasowana w całości na białym tle.
- **Opis oferty pod SEO** (`/api/descriptions/:imageId`): dostępny dopiero, gdy zdjęcie ma gotową grafikę;
  `POST` pisze tytuł (≤ 75 znaków), opis w HTML dozwolonym przez Allegro (h2/p/ul/ol/li/b) i frazy kluczowe
  z notatek sprzedawcy + analizy zdjęcia (gpt-4o-mini). Pierwszy opis jest darmowym bonusem do grafik; każde
  kolejne wywołanie AI (`POST …/refine` – poprawka promptem, ponowny `POST` – od nowa) zużywa jedną poprawkę:
  `DESCRIPTION_PROMPT_EDITS` (domyślnie 5) gratis na zdjęcie, potem `POST …/edit-packs` dokupuje 15 poprawek za
  1 kredyt (w transakcji kredytowej). Licznik rezerwowany atomowo, nieudane wywołania nie liczą się. `PATCH` to
  edycja ręczna bez limitu. Każdy zapis przechodzi przez sanitizer (`allegro-html.ts`).
- **Masowe przesyłanie** (`/bulk-upload`): trzy tryby – tylko wgranie (style wybierzesz później z galerii),
  wspólne style dla całej partii albo osobne style dla każdego pliku; podsumowanie kosztu przed startem.
- **Standard produkcyjny UI**: `ErrorBoundary` (błąd renderu → ekran z odświeżeniem zamiast pustej strony),
  `ConfirmProvider` (dostępne okna potwierdzeń zamiast `window.confirm`), strona 404, tytuły kart per ekran
  (`usePageTitle`), etykiety pól formularzy, stany błędów API z „Spróbuj ponownie” (dashboard, galeria),
  komunikaty o odrzuconych plikach (za duży / zły typ), usuwanie zdjęcia z galerii i z generatora, zmiana hasła
  w ustawieniach (`POST /api/auth/change-password` – wymaga obecnego hasła, wylogowuje inne sesje, odświeża cookie),
  `hasPassword` w `GET /api/users/me` (konta Google nie mają hasła). Panel aplikacji ma `noindex` i `robots.txt`.

## Spec-Driven Development

Źródłem prawdy jest [docs/specs/](docs/specs/README.md): wizja i wymagania (FR/NFR), cennik, specyfikacje
obszarów z kryteriami akceptacji `AC-…`, język UI, kontrakt API i ADR-y. Każde kryterium ma test z jego
identyfikatorem w nazwie; `node scripts/check-spec-coverage.js --report` (job CI `specs`) pilnuje pełnego
pokrycia w obie strony. Kontrakt API jest generowany z kodu do [docs/api/openapi.json](docs/api/openapi.json)
(`cd backend && npm run openapi`) i porównywany w testach. Proces i Definition of Done: [CONTRIBUTING.md](CONTRIBUTING.md).

### Bot bloga

`.github/workflows/daily-blog.yml` codziennie o 06:00 UTC uruchamia `landing-page/scripts/generate-blog-post.py`:
GitHub Models (`openai/gpt-4o`, token workflow z uprawnieniem `models: read`) pisze artykuł, skrypt waliduje
slug/kategorię/brak nieudokumentowanych procentów i HTML, odrzuca duplikaty (istniejący plik, podobieństwo
tematu, zlikwidowane slugi), zapisuje `src/data/blogPosts/<slug>.ts`, odświeża sitemapę i otwiera PR z etykietą
`blog` (etykieta jest tworzona automatycznie). Wymagany sekret `PAT_TOKEN`, żeby CI uruchomiło się na PR
i zadziałał auto-merge; bez niego PR powstaje z ostrzeżeniem. Tryb testowy: `workflow_dispatch` z `dry_run`
albo lokalnie `BLOG_DRY_RUN=1 python3 landing-page/scripts/generate-blog-post.py` (przykładowy artykuł
z `scripts/fixtures/`), a test `landing-page/e2e/blog-generator.spec.ts` sprawdza generator przy każdym CI.
Lista wpisów nie wymaga rejestru – `blogIndex.ts` jest generowany z katalogu przy buildzie.

## Testy i jakość

```bash
cd backend
npm run lint                 # ESLint
npm run typecheck            # tsc --noEmit
npm test                     # testy jednostkowe (prompty, style, walidacja obrazów, konfiguracja)
npm run test:db:up           # Postgres testowy (docker, port 5437)
npm run test:e2e             # testy integracyjne: auth, obrazy, generowanie+kredyty, płatności
```

Testy integracyjne uruchamiają prawdziwą aplikację Nest na prawdziwej bazie (migracje Prisma),
z podmienionymi usługami zewnętrznymi (Gemini/OpenAI, e-mail, Stripe – podpis webhooka liczony
prawdziwą biblioteką). Nigdy nie czytają `backend/.env`.

**Test z prawdziwym Gemini i OpenAI** (kosztuje ok. 0,05 USD, nigdy nie działa w CI):

```bash
RUN_LIVE_AI_TESTS=true GEMINI_API_KEY=... OPENAI_API_KEY=... npm run test:live
```

Generuje opis syntetycznego produktu, prompt dla stylu „Białe tło” i prawdziwy obraz, po czym
sprawdza, że wynik jest dekodowalny i (w przybliżeniu) kwadratowy.

```bash
cd frontend
npm test                     # Vitest: helper pobierania plików per platforma (iPhone, iPad, Android, desktop)
npx playwright install chromium webkit
npm run test:e2e             # Playwright: pobieranie i eksport grafik na Desktop Chrome, Desktop Safari,
                             # iPhone 14 (WebKit) i Pixel 7 (Chromium); API zamockowane, bez backendu
```

Pobieranie grafik na telefonach korzysta z Web Share API (arkusz „Zapisz obraz” w Zdjęciach), na
desktopie z `<a download>`; iOS bez wsparcia plików dostaje obraz w nowej karcie. Pliki są pobierane
z wyprzedzeniem (hover/dotknięcie karty), żeby arkusz udostępniania otworzył się w oknie interakcji
użytkownika; gdy przeglądarka i tak odrzuci wywołanie, pojawia się przycisk „Zapisz w Zdjęciach”.
Logika w `frontend/src/utils/download.ts` (kopia w landing page dla widgetu demo).

```bash
cd landing-page && npm run test:e2e   # Playwright: hydratacja prerenderowanych stron bez błędów React
```

**SEO po konsolidacji bloga:** każdy historyczny adres `/blog/<slug>` musi istnieć jako wpis albo
jako przekierowanie 301 w `landing-page/vercel.json`. `npm run check:redirects` (część buildu i CI)
blokuje build, gdy cel nie istnieje, są łańcuchy przekierowań albo slug z `src/data/retired-slugs.json`
stracił i wpis, i przekierowanie. Usuwając lub zmieniając slug wpisu, zawsze dodaj przekierowanie.

CI (`.github/workflows/ci.yml`) uruchamia lint, typecheck, testy jednostkowe i integracyjne,
build obrazu Docker, buildy frontendu i landing page, kontrolę przekierowań, testy przeglądarkowe
Playwright aplikacji oraz test hydratacji landing page przy każdym PR.

**Blog.** Codzienny generator (`.github/workflows/daily-blog.yml`) tworzy gałąź `blog/<data>-<slug>` i otwiera
PR (z `gh pr merge --auto`, jeśli w repozytorium włączono auto-merge). Odrzuca artykuły ze zmyślonymi
procentami bez źródła, waliduje slug i kategorię, a guard podobieństwa porównuje temat także z 49 wycofanymi
wpisami. Wymaga sekretu `PAT_TOKEN` z uprawnieniami `repo` i `models:read` (endpoint GitHub Models
`models.github.ai`).

## Wdrożenie

```bash
cp infra/.env.example infra/.env   # uzupełnij – docker compose odmówi startu bez JWT_SECRET/POSTGRES_PASSWORD
cd backend && build-and-push.bat    # obraz ghcr.io/mj426382/allgrafika-backend:latest
cd infra && docker compose up -d
```

Backend przy starcie waliduje konfigurację (w produkcji wymaga B2, SMTP i sekretu webhooka Stripe,
odrzuca placeholderowe sekrety), ma endpoint `GET /api/health` (healthcheck w Dockerze), nagłówki helmet,
rate limiting (`TRUST_PROXY=true` za reverse proxy) i wyłączony Swagger w produkcji.

**Migracje przy starcie.** Kontener uruchamia `node scripts/migrate.js`: jeśli produkcyjna baza ma już
schemat, ale w `_prisma_migrations` brakuje dwóch pierwszych migracji (powstały, zanim trafiły do gita),
skrypt oznacza je jako zastosowane (`prisma migrate resolve --applied`) i dopiero potem wykonuje
`migrate deploy`. Wypisuje też liczbę zawieszonych generacji, które reconciler oznaczy jako nieudane
i zwróci za nie kredyty. `MIGRATE_BASELINE=false` wyłącza krok baseline.

**Obserwowalność.** Każde żądanie dostaje `x-request-id` (przekazany z proxy/klienta albo UUID) zwracany też
w nagłówku odpowiedzi; błędy mają pole `requestId`. Logi to pino (`LOG_LEVEL`, JSON w produkcji, czytelne w dev),
z redakcją nagłówków autoryzacji i haseł. Błędy 5xx trafiają do Sentry, gdy ustawisz `SENTRY_DSN` (backend)
i `VITE_SENTRY_DSN` (aplikacja); bez DSN nic nie jest wysyłane.

**Sesja.** JWT trafia do cookie `ag_session` (httpOnly, Secure, SameSite=None między app. i api.);
każde żądanie z cookie musi mieć nagłówek `X-Requested-With: XMLHttpRequest` (ochrona CSRF – przeglądarka
nie doda go bez zaakceptowanego preflightu CORS). `Authorization: Bearer` nadal działa (skrypty, testy).
Reset hasła unieważnia wcześniejsze sesje.

**Panel operatora.** `GET /api/admin/overview` (użytkownicy, generacje per status, zawieszone, przychód,
subskrypcje, leady z demo), `GET /api/admin/feedback-stats` (kciuki per styl + powody odrzuceń),
`GET /api/admin/withdrawal-quote?email=` (wyliczenie zwrotu przy odstąpieniu od abonamentu, art. 35 u.p.k.,
z procedurą krok po kroku). Dostęp tylko dla adresów z `ADMIN_EMAILS`.

**Kolejka do Gemini.** `GEMINI_MAX_CONCURRENT` (domyślnie 4) ogranicza równoległe generacje w całym
procesie; hurtowe przesyłanie wielu użytkowników ustawia się w kolejce zamiast zalewać limit API.
Przy więcej niż jednym kontenerze limit się mnoży – wtedy potrzebna jest wspólna kolejka (BullMQ/Redis).

## Zmienne środowiskowe

Pełna lista z opisami: [backend/.env.example](backend/.env.example) i [infra/.env.example](infra/.env.example).
Frontend: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, opcjonalnie `VITE_SENTRY_DSN`, `VITE_PLAUSIBLE_DOMAIN`.

## API (skrót)

| Metoda | Endpoint | Opis |
|---|---|---|
| POST | `/api/auth/register` | Rejestracja (wymaga `acceptedTerms: true`) |
| POST | `/api/auth/login`, `/api/auth/google` | Logowanie |
| POST | `/api/auth/forgot-password`, `/api/auth/reset-password` | Reset hasła (token e-mail, 1 h, jednorazowy) |
| GET/PATCH/DELETE | `/api/users/me` | Profil, zmiana imienia, usunięcie konta (RODO) |
| POST | `/api/images/upload` | Upload zdjęcia (walidacja magic bytes, max 10 MB) |
| GET | `/api/generation/styles` | Katalog stylów + domyślny zestaw |
| POST | `/api/generation/:imageId/start` | Start generowania `{ styles?: string[], basePrompt?: string }` |
| POST | `/api/generation/:imageId/custom` | Własny prompt + opcjonalna referencja / przeróbka |
| POST | `/api/generation/retry/:id` | Ponowienie nieudanej generacji |
| GET | `/api/generation/:imageId/results` | Wyniki (polling) |
| POST | `/api/generation/feedback/:id` | Ocena grafiki (1 / -1 + powód) |
| POST | `/api/generation/export/:id` | Eksport w formacie Allegro / z plakietką |
| POST | `/api/demo` · GET `/api/demo/:id` | Darmowa próba bez konta (publiczne) |
| POST | `/api/payments/checkout` | Stripe Checkout (wymaga `acceptedWithdrawalWaiver: true`) |
| POST | `/api/payments/subscribe`, `/api/payments/portal` | Abonament (Stripe Billing) i portal klienta |
| GET/POST | `/api/allegro/*` | Status, OAuth, oferty, import, publikacja |
| POST | `/api/payments/webhook` | Webhook Stripe (idempotentny) |
| GET | `/api/health` | Healthcheck |

## Dokumenty prawne

Regulamin i polityka prywatności są współdzielone przez obie aplikacje
(`landing-page/src/legal/*` i identyczna kopia `frontend/src/legal/*`). Dane usługodawcy
(nazwa, adres, NIP, kontakt) są w `entity.ts`. Po zmianie jednego pliku skopiuj go do drugiego pakietu.
Skrzynka `kontakt@allgrafika.pl` jest adresem do reklamacji i żądań RODO – musi być odbierana.
