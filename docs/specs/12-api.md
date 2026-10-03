# 12 – Kontrakt API

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |

## Zasady

- Kontrakt jest **generowany z kodu** (dekoratory `@nestjs/swagger` na kontrolerach i DTO) do pliku
  [`docs/api/openapi.json`](../api/openapi.json) i wersjonowany w repo. Swagger UI (`/api/docs`) działa
  tylko poza produkcją.
- Zmiana endpointu lub DTO bez przegenerowania pliku jest błędem CI (test `[AC-API-001]`).
  Regeneracja: `cd backend && npm run openapi`.
- Prefiks `/api`. Uwierzytelnienie: cookie `ag_session` + nagłówek `X-Requested-With: XMLHttpRequest`
  (CSRF) albo `Authorization: Bearer`. Odpowiedzi błędów: `{ statusCode, message, error?, code? }`;
  `message` może być tablicą (walidacja class-validator). Nieznane pola w body → 400.
- Kody: `402` = brak kredytów / wymagany pakiet (`code: EDIT_PACK_REQUIRED`), `409` = warunek wstępny
  (np. opis bez grafiki), `429` = limit żądań albo limit generacji w toku.
- Wersjonowanie: zmiany łamiące wymagają nowego prefiksu wersji w ścieżce i ADR; dodawanie pól jest
  zgodne wstecz.

## Obszary (szczegóły w specyfikacjach funkcji)

| Obszar | Endpointy |
|---|---|
| Auth | `POST /auth/register`, `/login`, `/google`, `/logout`, `/session`, `/forgot-password`, `/reset-password`, `/change-password` |
| Users | `GET/PATCH/DELETE /users/me` |
| Images | `POST /images/upload`, `GET /images`, `GET/DELETE /images/:id` |
| Generation | `GET /generation/styles`, `POST /generation/:imageId/start`, `/custom`, `POST /generation/retry/:id`, `GET /generation/download/:id`, `POST /generation/feedback/:id`, `POST /generation/export/:id`, `GET /generation/:imageId/results`, `GET /generation/result/:id` |
| Descriptions | `GET/POST/PATCH /descriptions/:imageId`, `POST /descriptions/:imageId/refine`, `POST /descriptions/:imageId/edit-packs` |
| Payments | `GET /payments/packages`, `/plans`, `/history`, `/subscription`, `POST /payments/checkout`, `/subscribe`, `/portal`, `/webhook` |
| Allegro | `GET /allegro/status`, `/auth-url`, `/offers`, `POST /allegro/callback`, `/import`, `/publish`, `DELETE /allegro/connection` |
| Demo | `POST /demo`, `GET /demo/:id` |
| Admin | `GET /admin/overview`, `/feedback-stats`, `/withdrawal-quote` |
| Health | `GET /health` |

## Kryteria akceptacji

- **AC-API-001** – Given uruchomiona aplikacja testowa, When wygenerowany zostanie dokument OpenAPI, Then jest identyczny z `docs/api/openapi.json` i opisuje ponad 20 ścieżek.
- **AC-API-002** – Given żądanie z polem spoza DTO, When trafi do dowolnego endpointu z walidacją, Then odpowiedź to 400 (whitelist + forbidNonWhitelisted).
- **AC-API-003** – Given endpoint `GET /health`, When wywołany bez sesji, Then zwraca 200 ze statusem usługi.
