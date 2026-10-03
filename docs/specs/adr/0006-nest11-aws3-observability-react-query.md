# ADR-0006: NestJS 11 (CommonJS) zamiast 12, AWS SDK v3, pino + Sentry, React Query

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Data | 2026-10-03 |

## Kontekst

Audyt zależności wykazał 7 podatności wysokich w backendzie (sharp/libvips, multer, axios, lodash,
js-yaml, form-data, platform-express) i przestarzałe aws-sdk v2. Kontrolery używały `req: any`,
błędy 500 nie były logowane z kontekstem, a frontend pobierał dane jedenastoma ręcznymi `useEffect`.

## Decyzje

- **NestJS 11, nie 12.** Nest 12 jest wydany wyłącznie jako ESM (`"type": "module"`); backend, ts-jest,
  skrypty migracji i konfiguracja CommonJS wymagałyby osobnej migracji modułów. Nest 11 (CommonJS,
  Express 5, multer 2) usuwa zgłoszone podatności przy zerowej zmianie API. Przejście na ESM i Nest 12
  to osobne zadanie z własnym ADR.
- **AWS SDK v3** (`@aws-sdk/client-s3` + presigner) zamiast aws-sdk v2 (EOL, źródło podatności).
  Podpisywanie URL jest asynchroniczne – `StorageService.getSignedUrl` zwraca `Promise`.
- **Typowany użytkownik sesji**: dekorator `@CurrentUser()` i interfejs `SessionUser` zastępują
  `@Request() req: any`; surowe żądanie zostaje tylko tam, gdzie jest potrzebne (IP w demo, raw body webhooka).
- **Obserwowalność**: `x-request-id` (przekazany albo UUID) w każdym żądaniu i odpowiedzi, globalny
  `HttpExceptionFilter` (5xx logowane ze stosem, metodą, ścieżką i użytkownikiem; odpowiedź bez wnętrzności,
  z `requestId`), pino przez `nestjs-pino` (JSON w produkcji, pretty w dev, cisza w testach, redakcja
  nagłówków i haseł), Sentry w backendzie i frontendzie włączane tylko przez `SENTRY_DSN` / `VITE_SENTRY_DSN`.
- **React Query** dla stanu serwerowego w aplikacji (dashboard, galeria, kredyty); retry wyłączone, bo każdy
  ekran ma własny stan błędu z ponowieniem; cache czyszczony przy wylogowaniu i 401.
- **Jedno źródło dokumentów prawnych**: `landing-page/src/legal` kopiowane do aplikacji przed `dev`/`build`
  (`scripts/sync-legal.js`), CI dodatkowo porównuje kopie.
- **Narzędzia**: Prettier we wszystkich projektach z `format:check` w CI, `engines` + `.nvmrc` (Node 24),
  ESLint z `react` i `jsx-a11y` w obu aplikacjach React.

## Konsekwencje

- `npm audit --omit=dev` w backendzie bez podatności wysokich z naszych zależności bezpośrednich.
- Każdy błąd 500 ma identyfikator, który użytkownik może podać w zgłoszeniu.
- Generator jest podzielony na hook (`useGenerations`) i komponenty (`StylePicker`, `CustomStyleForm`, `ResultCard`).
