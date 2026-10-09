# 20 – Program poleceń

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-09 |
| Powiązane | FR-REF-001, spec 03 (konto), spec 13 (weryfikacja e-mail), spec 19 (monetyzacja) |

## 1. Problem i cel

Ruch jest mały (ok. 4 rejestracje tygodniowo), a płatna reklama się nie zwraca (spec 19, analiza 2026-10-09).
Polecenia od zadowolonych sprzedawców są najtańszym kanałem: koszt nagrody to wyłącznie AI (ok. 0,20 zł
za grafikę).

## 2. Decyzje produktowe (właściciel, 2026-10-09)

- **Nagroda**: polecający i polecony dostają po 3 kredyty (`REFERRAL_BONUS`) za każde nowe konto
  założone z linku polecającego. Kredyty są zapisywane w `credit_grants` z adnotacją `polecenia`.
- **Link polecający**: `https://app.allgrafika.pl/register?ref=<kod>`.
  - Kod ma 8 losowych znaków, bez danych osobowych.
  - Powstaje przy pierwszym otwarciu sekcji poleceń.
  - Aplikacja zapamiętuje kod do końca rejestracji, także przy przejściu przez logowanie.
- **Kiedy nagroda**:
  - Przy rejestracji e-mailem: dopiero po potwierdzeniu adresu e-mail przez poleconego, żeby
    fałszywe konta nic nie dawały.
  - Przy rejestracji przez Google: od razu, bo adres jest potwierdzony przez Google.
  - Nagroda jest jednorazowa na konto poleconego.
- **Ochrona przed nadużyciami**:
  - Jedno konto na skrzynkę (spec 13).
  - Własny kod nie działa, bo kod jest przypisany do innego konta.
  - Nieznany kod jest ignorowany bez błędu.
  - Polecający dostaje nagrodę za maksymalnie 25 poleconych (`REFERRAL_MAX_REWARDS`). Polecony
    dostaje swoją zawsze.
- **Sekcja w aplikacji** (Konto):
  - Link z przyciskami „Kopiuj” i „Udostępnij” (arkusz udostępniania na telefonie).
  - Liczba poleconych kont i zdobytych kredytów.
- **Regulamin**: zasady programu poleceń w § o Kredytach.

## 3. Kryteria akceptacji

- **AC-REF-001** – Given zalogowany użytkownik, When pobiera `GET /users/me/referral`, Then dostaje stały kod i link `…/register?ref=<kod>` oraz liczbę poleconych i zdobytych kredytów; kod nie zawiera danych osobowych.
- **AC-REF-002** – Given rejestracja e-mailem z poprawnym kodem, When polecony potwierdzi adres e-mail, Then obie strony dostają po 3 kredyty (zapis w `credit_grants`), a przed potwierdzeniem nikt nic nie dostaje; ponowne otwarcie linku weryfikacyjnego nie daje drugiej nagrody.
- **AC-REF-003** – Given rejestracja przez Google z poprawnym kodem, When konto powstaje, Then obie strony dostają nagrodę od razu; logowanie istniejącym kontem Google z kodem nic nie zmienia.
- **AC-REF-004** – Given nieznany kod, When rejestracja, Then konto powstaje bez polecającego i bez błędu. Given polecający z 25 nagrodzonymi poleceniami, When kolejny polecony potwierdzi e-mail, Then polecony dostaje 3 kredyty, a polecający nic.
- **AC-REF-005** – Given wejście na `/register?ref=<kod>`, When użytkownik przejdzie do logowania i wróci albo zarejestruje się przez Google, Then kod trafia do rejestracji; strona rejestracji informuje o 3 grafikach w prezencie.
- **AC-REF-006** – Given strona Konto, When użytkownik otwiera sekcję poleceń, Then widzi link, kopiuje go przyciskiem i widzi licznik poleconych i zdobytych kredytów.
