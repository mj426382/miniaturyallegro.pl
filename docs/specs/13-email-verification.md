# 13 – Weryfikacja i normalizacja adresu e-mail

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-04 |
| Powiązane | FR-AUTH-002, FR-AUTH-003, 02, 03, NFR-SEC-010, NFR-REL-006 |

## 1. Problem i cel

Każde nowe konto dostaje 10 darmowych grafik. Bez potwierdzenia adresu i bez normalizacji można zakładać
konta seryjnie (`jan@gmail.com`, `jan+1@gmail.com`, `j.an@gmail.com`, `JAN@gmail.com`) i zbierać darmowe
kredyty, a reset hasła nie ma pewności, że mail trafia do właściciela konta. Sukces: jedna skrzynka = jedno
konto = jedna darmowa pula; nowe konta generują dopiero po kliknięciu linku z maila.

## 2. Zakres

- W zakresie: kanoniczna postać adresu i jej unikalność, potwierdzenie adresu linkiem, ponowna wysyłka,
  blokada generowania i płatności do potwierdzenia, limit demo po postaci kanonicznej, wysyłka maili
  z domeny allgrafika.pl (SPF, DKIM, DMARC).
- Poza zakresem (świadomie): zmiana adresu e-mail konta, blokowanie domen jednorazowych skrzynek
  (lista szybko się starzeje; wrócimy, jeśli statystyki pokażą nadużycia).

## 3. Decyzje produktowe

- **Postać kanoniczna** (`emailCanonical`): adres po `trim` i małych literach; domena `googlemail.com` →
  `gmail.com`; w części lokalnej obcinamy wszystko od pierwszego `+` (jeśli coś zostaje); dla `gmail.com`
  usuwamy kropki z części lokalnej. Przykład: `J.Mateusz14+111@GoogleMail.com` → `jmateusz14@gmail.com`.
  Obcinanie `+` dotyczy wszystkich domen – popularne skrzynki (Gmail, Outlook, iCloud, Onet, WP, Interia)
  dostarczają aliasy `+` do tej samej skrzynki.
- `email` przechowuje adres tak, jak go wpisano (po `trim` i małych literach) – na niego wysyłamy maile.
  `emailCanonical` jest unikalny i służy wyłącznie do wykrywania duplikatów i wyszukiwania konta.
- Rejestracja na adres, którego postać kanoniczna już istnieje → 409 „Konto z tym adresem email już
  istnieje (adresy różniące się kropkami, wielkością liter albo dopiskiem „+…” traktujemy jako ten sam)”.
- Logowanie, reset hasła i Google: najpierw dokładny adres, potem postać kanoniczna. Użytkownik może więc
  zalogować się dowolnym aliasem swojej skrzynki.
- **Istniejące konta** (przed wdrożeniem): wszystkie dostają `emailVerifiedAt = createdAt` (nie blokujemy
  ludzi, którzy już korzystają). Jeśli dwa stare konta mają tę samą postać kanoniczną, najstarsze dostaje
  postać kanoniczną, pozostałe zachowują unikalny znacznik `legacy` – nadal logują się dokładnym adresem.
- **Potwierdzenie**: po rejestracji e-mail+hasło wysyłamy link ważny 24 h, jednorazowy, przechowujemy tylko
  hash SHA-256 tokenu. Kliknięcie linku potwierdza adres (nie loguje – link może być otwarty na innym
  urządzeniu). Nowy link unieważnia poprzednie. Ponowna wysyłka najwcześniej 60 s po poprzedniej.
- Konta Google są potwierdzone od razu (Google zweryfikował adres; niezweryfikowany adres Google jest
  odrzucany już dziś).
- **Co może konto niepotwierdzone**: logować się, przeglądać, wgrywać zdjęcia, ustawiać konto. Nie może
  generować grafik (start, własny styl, ponowienie, pakiet poprawek) ani kupować kredytów – odpowiedź 403
  z kodem `EMAIL_NOT_VERIFIED`. Darmowa pula „odblokowuje się” z chwilą potwierdzenia.
- Przełącznik `EMAIL_VERIFICATION_REQUIRED` (domyślnie `true`) pozwala operatorowi wyłączyć blokadę,
  gdy poczta nie działa – link i baner dalej działają.
- Demo bez konta: limit 1 próby na skrzynkę liczony po postaci kanonicznej.
- **Nadawca**: `AllGrafika <no-reply@allgrafika.pl>` przez serwer pocztowy na VPS (konto SMTP
  `no-reply@allgrafika.pl`, podpis DKIM domeny allgrafika.pl); w DNS rekordy SPF, DKIM i DMARC.

## 4. Przepływ użytkownika (UX)

1. Rejestracja → zalogowany użytkownik widzi dashboard z banerem nad treścią: „Potwierdź adres e-mail –
   wysłaliśmy link na **adres**. Do tego czasu nie możesz generować grafik.” Przycisk „Wyślij link
   ponownie”, po wysłaniu toast „Wysłaliśmy nowy link”. Przy limicie: komunikat z serwera.
2. Próba generowania przed potwierdzeniem → toast z komunikatem serwera (z instrukcją).
3. Link z maila otwiera `/verify-email?token=…` (strona publiczna, układ `AuthLayout`): stan ładowania,
   sukces „Adres potwierdzony – możesz generować grafiki” z przyciskiem do aplikacji (zalogowany) albo do
   logowania; błąd „Link jest nieprawidłowy lub wygasł” z instrukcją, że nowy link można wysłać po
   zalogowaniu.
4. Po potwierdzeniu baner znika (profil odświeżany po sukcesie strony weryfikacji i po powrocie na kartę).

## 5. Wymagania funkcjonalne

- **FR-AUTH-002** – Unikalność kont po kanonicznej postaci adresu e-mail.
- **FR-AUTH-003** – Potwierdzenie adresu e-mail warunkiem generowania i płatności.

## 6. Kryteria akceptacji

- **AC-VER-001** – Given adresy z wielkimi literami, kropkami w Gmailu, aliasem `+` i domeną `googlemail.com`, When kanonizacja, Then wynik jest zgodny z zasadami z p. 3 (kropki usuwane tylko w Gmailu, `+` obcinany wszędzie, część lokalna nigdy nie zostaje pusta).
- **AC-VER-002** – Given konto `jan.kowalski@gmail.com`, When rejestracja `Jan.Kowalski+promo@googlemail.com` albo `JANKOWALSKI@gmail.com`, Then 409 i nie powstaje drugie konto; rejestracja `jan.kowalski+x@firma.pl` przy istniejącym `jan.kowalski@firma.pl` też 409.
- **AC-VER-003** – Given konto `jan.kowalski@gmail.com`, When logowanie aliasem `JanKowalski+abc@gmail.com` z poprawnym hasłem, Then sesja tego konta; reset hasła na alias wysyła link na zapisany adres konta.
- **AC-VER-004** – Given świeża rejestracja e-mail+hasło, When odpowiedź, Then `emailVerified=false` w `/users/me`, wysłany jest mail z linkiem `/verify-email?token=…`, a w bazie jest tylko hash tokenu.
- **AC-VER-005** – Given niepotwierdzone konto, When start generacji, własny styl, ponowienie, zakup pakietu poprawek, checkout pakietu albo abonamentu, Then 403 `EMAIL_NOT_VERIFIED`, kredyty i wiersze generacji bez zmian.
- **AC-VER-006** – Given ważny token, When `POST /auth/verify-email`, Then `emailVerified=true`, token zużyty, generowanie działa; ponowne użycie tego linku przez potwierdzone konto → 200 `alreadyVerified`; token nieznany lub po 24 h → 400.
- **AC-VER-007** – Given niepotwierdzone konto, When ponowna wysyłka, Then nowy mail z nowym tokenem, stary token przestaje działać; druga prośba w ciągu 60 s → 429; konto potwierdzone → 200 `alreadyVerified` bez maila.
- **AC-VER-008** – Given logowanie Google (nowe konto albo dołączenie do istniejącego konta e-mail o tej samej postaci kanonicznej), When sukces, Then konto jest potwierdzone i połączone z Google, nie powstaje duplikat.
- **AC-VER-009** – Given migracja na danych produkcyjnych (konta z różnymi postaciami tej samej skrzynki), When `migrate deploy`, Then wszystkie istniejące konta są potwierdzone, najstarsze dostaje postać kanoniczną, pozostałe unikalny znacznik `legacy` i nadal logują się dokładnym adresem.
- **AC-VER-010** – Given demo z `anna+1@gmail.com` wykorzystane, When demo z `a.nna@gmail.com`, Then 409 (limit per skrzynka, ten sam komunikat co dla identycznego adresu).
- **AC-VER-011** – Given `EMAIL_VERIFICATION_REQUIRED=false`, When niepotwierdzone konto generuje, Then generowanie działa.
- **AC-VER-012** – Given niepotwierdzony użytkownik w aplikacji, When widzi dowolny ekran, Then baner z adresem i przyciskiem ponownej wysyłki; po kliknięciu toast sukcesu; potwierdzony użytkownik banera nie widzi.
- **AC-VER-013** – Given link z maila, When strona `/verify-email`, Then stan sukcesu z przejściem do aplikacji albo logowania; dla złego tokenu komunikat błędu z instrukcją; strona działa bez zalogowania.

## 7. API

- `POST /auth/verify-email {token}` – publiczny, throttle 10/min; 200 `{verified:true, alreadyVerified?}`; 400 dla złego/wygasłego tokenu.
- `POST /auth/resend-verification` – JWT, throttle 3/min; 200 `{sent:true}` albo `{alreadyVerified:true}`; 429 przy cooldownie 60 s.
- `GET /users/me` – nowe pole `emailVerified: boolean`.
- Błąd blokady: 403 `{code:"EMAIL_NOT_VERIFIED", message}`.

## 8. Dane i migracje

Migracja `20261004090000_email_verification_invoices`:
- `users.emailCanonical TEXT NOT NULL UNIQUE` (backfill w SQL tą samą regułą co w kodzie; duplikaty →
  `<email>#legacy:<id>`), `users.emailVerifiedAt TIMESTAMP NULL` (backfill `createdAt`), adresy w `email`
  sprowadzone do małych liter, gdy nie tworzy to konfliktu.
- Tabela `email_verification_tokens (id, userId FK cascade, tokenHash UNIQUE, expiresAt, usedAt, createdAt)`.
- `demo_requests.emailCanonical TEXT NULL` + indeks (stare wiersze bez wartości).

## 9. Wymagania niefunkcjonalne

- Token: 32 bajty losowe, w bazie tylko SHA-256; link nie trafia do logów w produkcji.
- Wysyłka maila nie może wywrócić rejestracji – błąd SMTP jest logowany, użytkownik może wysłać ponownie.
- Dostarczalność: SPF `ip4` serwera, DKIM 2048-bit, DMARC `p=none` na start.

## 10. Wpływ na dokumenty

Regulamin: darmowa pula po potwierdzeniu adresu. Landing/cennik: „10 darmowych grafik po potwierdzeniu e-maila”.

## 11. Ryzyka i pytania otwarte

- Rekordy DNS dodaje właściciel domeny (Vercel DNS). Do czasu ich dodania Gmail może odrzucać maile –
  wtedy operator ustawia `EMAIL_VERIFICATION_REQUIRED=false`.

## 12. Plan testów

AC-VER-001 unit; AC-VER-002..011 integracyjne (Postgres testowy, fałszywa poczta); AC-VER-009 test
migracji na danych z duplikatami; AC-VER-012..013 przeglądarkowe (Playwright, 4 profile urządzeń).
