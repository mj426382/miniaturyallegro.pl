# 03 – Konto: rejestracja, logowanie, sesja, hasło, usunięcie

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |
| Powiązane | FR-AUTH-001, NFR-SEC-001, NFR-LAW-001/003, ADR-0001 |

## 1. Problem i cel

Sprzedawca zakłada konto w minutę (e-mail+hasło albo Google), nie traci sesji na telefonie, może
odzyskać i zmienić hasło, a także usunąć konto razem z danymi (RODO).

## 2. Decyzje

- Kanoniczna postać adresu, potwierdzenie e-maila i blokada generowania do potwierdzenia: zob. [13](13-email-verification.md).

- Sesja: JWT w cookie `ag_session` (httpOnly, Secure, SameSite=None w produkcji), 30 dni; każde żądanie
  z cookie musi mieć `X-Requested-With: XMLHttpRequest`. `Authorization: Bearer` działa dla skryptów.
- Hasło: min. 8 znaków, wielka i mała litera, cyfra, znak specjalny, nie zawiera e-maila. bcrypt.
- Google: nowe konto wymaga jawnej akceptacji regulaminu (`TERMS_REQUIRED`) i zweryfikowanego e-maila.
- Reset hasła: link e-mail, token sha256, 1 h, jednorazowy; po resecie i po zmianie hasła wszystkie
  starsze JWT są nieważne (`passwordChangedAt`).
- Zmiana hasła wymaga obecnego hasła; bieżąca sesja dostaje nowy cookie, inne są wylogowane.
- Usunięcie konta: użytkownik przepisuje swój e-mail i potwierdza w oknie; kasowane są zdjęcia, grafiki,
  opisy, pliki w B2, abonament Stripe.
- Konta Google bez hasła widzą w ustawieniach wskazówkę zamiast formularza (`hasPassword=false`).

## 3. UX

- Ekrany bez sesji w `AuthLayout`; błędy w `FormAlert` przy formularzu; `PasswordInput` z „Pokaż”.
- Rejestracja: przycisk nieaktywny do spełnienia reguł i akceptacji regulaminu; walidacja w regionach
  o stałej wysokości (bez skoków układu).
- Wylogowanie z menu; wygaśnięcie sesji przenosi na `/login`.

## 4. API

`POST /auth/register|login|google|logout|session|forgot-password|reset-password|change-password`,
`GET|PATCH|DELETE /users/me`. Logowanie: 200; rejestracja/zmiana hasła: 201; błędne dane logowania: 401
z ogólnym komunikatem; limit prób: 429.

## 5. Kryteria akceptacji

- **AC-AUTH-001** – Given poprawne dane i zaakceptowany regulamin, When rejestracja, Then konto istnieje, `termsAcceptedAt` jest zapisane, odpowiedź zawiera token i ustawia cookie sesji.
- **AC-AUTH-002** – Given brak akceptacji regulaminu, When rejestracja, Then 400 i konto nie powstaje.
- **AC-AUTH-003** – Given hasło niespełniające reguł lub zawierające e-mail, When rejestracja, Then 400 z czytelnym komunikatem.
- **AC-AUTH-004** – Given nieznane pole w body lub zajęty e-mail, When rejestracja, Then odpowiednio 400 / 409.
- **AC-AUTH-005** – Given istniejące konto, When logowanie poprawnym hasłem, Then 200 z sesją; błędne hasło lub nieistniejący e-mail → 401 z tym samym ogólnym komunikatem.
- **AC-AUTH-006** – Given brak sesji, When żądanie do chronionego endpointu, Then 401.
- **AC-AUTH-007** – Given prośba o reset, When użytkownik użyje linku z e-maila, Then hasło zmienione, link jednorazowy, logowanie nowym hasłem działa.
- **AC-AUTH-008** – Given sesja wydana przed resetem hasła, When użyta po resecie, Then 401.
- **AC-AUTH-009** – Given nieprawidłowy, zużyty lub przeterminowany token, When reset, Then 400.
- **AC-AUTH-010** – Given zalogowany użytkownik, When zmieni hasło podając obecne, Then dostaje nową sesję, inne sesje tracą ważność, stare hasło nie loguje; błędne obecne hasło lub słabe nowe → 400; bez sesji → 401.
- **AC-AUTH-011** – Given profil użytkownika, When `GET /users/me`, Then zawiera `hasPassword` i nigdy hasha hasła.
- **AC-AUTH-012** – Given pierwsze logowanie Google, When brak akceptacji regulaminu lub e-mail niezweryfikowany, Then konto nie powstaje (kod `TERMS_REQUIRED` / 401).
- **AC-AUTH-013** – Given zalogowany użytkownik, When `GET /users/me`, Then odpowiedź zawiera kredyty, zużyte darmowe i liczniki.
- **AC-AUTH-014** – Given zalogowany użytkownik, When zmieni imię, Then profil jest zaktualizowany (trim, ≤ 100 znaków).
- **AC-AUTH-015** – Given zalogowany użytkownik, When usunie konto podając swój e-mail, Then konto i dane kaskadowo znikają; inny e-mail → 400.
- **AC-AUTH-016** – Given brak sesji, When wejście na prywatną stronę aplikacji, Then przekierowanie na `/login`.
- **AC-AUTH-017** – Given formularz rejestracji, When pola są niepoprawne lub regulamin niezaznaczony, Then przycisk „Zarejestruj się” jest nieaktywny, a po poprawieniu rejestracja prowadzi na dashboard.
- **AC-AUTH-018** – Given formularz resetu, When wysłany dla dowolnego e-maila, Then zawsze ten sam komunikat potwierdzenia (bez ujawniania istnienia konta).
- **AC-AUTH-019** – Given link z tokenem, When użytkownik ustawi nowe hasło spełniające reguły, Then trafia na `/login`, a żądanie zawiera token i hasło.
- **AC-AUTH-020** – Given strona resetu bez tokenu, When otwarta, Then widać komunikat o nieprawidłowym linku i link do ponownej wysyłki.
- **AC-AUTH-021** – Given ustawienia konta, When użytkownik zapisze imię, zmieni hasło (z walidacją i błędnym obecnym hasłem) i usunie konto po potwierdzeniu, Then każda akcja woła właściwy endpoint, a po usunięciu trafia na `/login`.
- **AC-AUTH-022** – Given zalogowany użytkownik, When kliknie „Wyloguj się”, Then trafia na `/login`, `POST /auth/logout` jest wywołane, a prywatne strony przekierowują.
- **AC-AUTH-023** – Given reguły hasła w UI, When hasło nie spełnia reguł, Then lista brakujących wymagań i siła hasła są wyliczane tak samo jak w API.
