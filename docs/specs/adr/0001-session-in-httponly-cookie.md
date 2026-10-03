# ADR-0001: Sesja w cookie httpOnly z nagłówkiem CSRF zamiast JWT w localStorage

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Data | 2026-10-02 |

## Kontekst

Pierwsza wersja aplikacji trzymała JWT w `localStorage`. Każdy XSS (np. przez treść bloga albo
zależność) mógł ukraść token na 30 dni. Aplikacja (`app.`) i API (`api.`) są na różnych subdomenach.

## Decyzja

JWT trafia do cookie `ag_session` (`httpOnly`, `Secure`, `SameSite=None` w produkcji, `Lax` lokalnie,
30 dni). Każde żądanie z cookie musi mieć nagłówek `X-Requested-With: XMLHttpRequest`; przeglądarka nie
wyśle go cross-site bez zaakceptowanego preflightu CORS, co blokuje CSRF. `Authorization: Bearer`
pozostaje dla skryptów i testów. Reset i zmiana hasła ustawiają `passwordChangedAt`, które unieważnia
wcześniejsze tokeny (sprawdzane w strategii JWT przy każdym żądaniu, razem z istnieniem użytkownika).

## Konsekwencje

- Frontend nie zna tokenu; stan zalogowania ustala przez `GET /users/me` przy starcie.
- Handler 401 jest uzbrajany dopiero po udanym bootstrapie, inaczej strony publiczne przekierowywałyby na login.
- Każde żądanie wykonuje zapytanie o użytkownika (koszt akceptowalny przy obecnej skali; cache w razie potrzeby).
- Testy integracyjne używają Bearer, przeglądarkowe – cookie przez mocki.
