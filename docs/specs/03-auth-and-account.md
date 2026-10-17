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
- **Token sesji w treści odpowiedzi tylko poza przeglądarką** (przegląd bezpieczeństwa 2026-10-17):
  - Rejestracja, logowanie, Google i zmiana hasła zawsze ustawiają cookie `ag_session`.
  - Pole `token` w treści odpowiedzi dostaje tylko aplikacja natywna (spec 18), rozpoznawana po
    nagłówku `Origin` z listy originów aplikacji (`https://native.allgrafika.pl`,
    `capacitor://native.allgrafika.pl`). `Origin` ustawia przeglądarka, więc skrypt na stronie (XSS)
    nie może się pod nią podszyć.
  - Klient bez `Origin` i bez nagłówków `Sec-Fetch-*` (skrypty, testy, integracje serwerowe) też dostaje
    token, bo nie ma w nim strony, z której XSS mógłby go odczytać.
  - Przeglądarka z originem strony (np. `https://app.allgrafika.pl`) nie dostaje tokenu w treści – web
    korzysta wyłącznie z cookie httpOnly.
- **Ślad usuniętego konta** (przegląd 2026-10-17; ochrona darmowej puli przed „usuń konto i załóż
  od nowa”):
  - Przy usunięciu konta zapisujemy wyłącznie skrót HMAC-SHA256 postaci kanonicznej adresu (spec 13:
    małe litery, `trim`, `+alias` obcięty, kropki Gmaila usunięte, `googlemail.com` → `gmail.com`) i datę
    usunięcia (`account_tombstones`).
  - Klucz HMAC jest wyprowadzony z `JWT_SECRET` (HKDF, osobna etykieta) albo podany w
    `ACCOUNT_TOMBSTONE_SECRET`. Adres w postaci jawnej nie zostaje nigdzie w bazie.
  - Rejestracja (e-mail i Google) adresu, którego skrót jest w tabeli: konto powstaje normalnie, ale
    z pulą 0 darmowych grafik i bez programu poleceń (spec 20). Mail weryfikacyjny nie obiecuje wtedy
    darmowych grafik.
  - Retencja: `ACCOUNT_TOMBSTONE_RETENTION_MONTHS` (domyślnie 12, liczba całkowita 1–36). Starsze wpisy
    usuwa zadanie uruchamiane przy starcie aplikacji i co 24 h.
  - Podstawa prawna: prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO) – zapobieganie nadużyciom
    darmowej puli; zapis w polityce prywatności.

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
- **AC-AUTH-024** – Given konto z hasłem, którego adres nigdy nie został potwierdzony, When właściciel adresu zaloguje się przez Google na ten sam adres, Then konto zostaje połączone z Google i potwierdzone, a dotychczasowe hasło przestaje działać (401) i wcześniejsze sesje wygasają – hasło mógł ustawić ktoś, kto zajął adres przed właścicielem; nowe hasło ustawia się linkiem resetu. Konto potwierdzone zachowuje hasło.
- **AC-AUTH-025** – Given link resetu hasła, When dwa żądania z tym samym tokenem przyjdą równocześnie, Then tylko jedno ustawia hasło, drugie dostaje 400; Given awaria wysyłki maila, When prośba o reset istniejącego konta, Then odpowiedź jest taka sama jak dla nieistniejącego (200, ten sam komunikat), a błąd trafia do logów.
- **AC-AUTH-026** – Given konto, którego adres (albo jego alias) skorzystał wcześniej z demo na landingu, When użytkownik usunie konto, Then wiersze demo z tym adresem i ich pliki (zdjęcie i wynik) są usuwane razem z kontem, a demo innych adresów zostaje.
- **AC-AUTH-027** – Given niezalogowany użytkownik otwiera prywatny adres aplikacji (np. link z maila do `/credits`), When zostanie przekierowany na `/login` i się zaloguje, Then wraca na ten adres; adresy spoza aplikacji (`//…`) są ignorowane i prowadzą na pulpit.
- **AC-AUTH-023** – Given reguły hasła w UI, When hasło nie spełnia reguł, Then lista brakujących wymagań i siła hasła są wyliczane tak samo jak w API.
- **AC-AUTH-028** – Given rejestracja, logowanie, logowanie Google albo zmiana hasła, When żądanie przychodzi z przeglądarki z originem strony (także z nagłówkami `Sec-Fetch-*` bez `Origin`), Then odpowiedź ustawia cookie sesji i nie zawiera pola `token`; When przychodzi z originu aplikacji natywnej albo od klienta bez `Origin` i `Sec-Fetch-*`, Then zawiera `token`, który działa jako `Authorization: Bearer`.
- **AC-AUTH-033** – Given data przed `ACCOUNT_TOMBSTONES_FROM` (domyślnie 2026-11-01T00:00:00+01:00 – regulamin § 3 ust. 6 i § 11, 14 dni po publikacji), When konto jest usuwane, Then skrót adresu e-mail nie jest zapisywany, a ponowna rejestracja tym adresem dostaje zwykłą darmową pulę; od tej daty usunięcie zapisuje skrót zgodnie z AC-AUTH-029; niepoprawna data blokuje start aplikacji.
- **AC-AUTH-029** – Given konto (także z aliasem lub kontem Google), When użytkownik je usunie, Then w `account_tombstones` jest dokładnie jeden wpis: skrót HMAC postaci kanonicznej adresu i data usunięcia; żadna tabela bazy nie zawiera adresu ani jego postaci kanonicznej, a skrót nie jest zwykłym SHA-256 adresu (bez klucza nie da się go odtworzyć).
- **AC-AUTH-030** – Given usunięte konto, When ktoś zarejestruje e-mailem ten sam adres albo jego wariant (wielkie litery, spacje, kropki w Gmailu, `+alias`, `googlemail.com`), Then konto powstaje (201) z pulą 0 darmowych grafik, a mail weryfikacyjny nie obiecuje darmowych grafik; rejestracja innego adresu dostaje pełną pulę.
- **AC-AUTH-031** – Given usunięte konto, When właściciel tej skrzynki założy konto przez Google, Then konto powstaje z pulą 0 darmowych grafik.
- **AC-AUTH-032** – Given wpisy śladu starsze i młodsze niż okres retencji, When działa zadanie sprzątania, Then znikają tylko starsze; po ich usunięciu rejestracja tego adresu dostaje pełną pulę; Given `ACCOUNT_TOMBSTONE_RETENTION_MONTHS` spoza 1–36 albo niecałkowite, When start, Then walidacja konfiguracji zgłasza błąd.

## 6. Dane i migracje

Migracja `20261018100000_tombstones_upload_quota` (addytywna): tabela `account_tombstones (id, emailHash
TEXT UNIQUE, deletedAt TIMESTAMP, indeks po deletedAt)` – bez klucza obcego do `users`, bo konta już nie
ma. Ponowne usunięcie konta na ten sam adres odświeża datę istniejącego wpisu.

## 7. Wpływ na dokumenty

Polityka prywatności: nowy cel „zapobieganie nadużyciom darmowej puli” – skrót adresu e-mail usuniętego
konta, art. 6 ust. 1 lit. f RODO, 12 miesięcy.
