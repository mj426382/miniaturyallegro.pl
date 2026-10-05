# 16 – Maile cykliczne i panel administratora

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-05 |
| Powiązane | FR-NOT-001, FR-ADM-002, 13, 05, 15, NFR-LAW-005 |

## 1. Problem i cel

Większość kont rejestruje się, generuje kilka grafik i znika, nie wykorzystując darmowej puli. Właściciel nie
widzi też, kto się zarejestrował i ile używa aplikacji, i nie ma jak napisać do konkretnego klienta. Cel:
przypomnienia, które zamieniają rejestracje w płacących klientów, powiadomienie o zakończeniu dużej paczki
oraz panel, w którym właściciel widzi użytkowników i może wysłać im wiadomość.

## 2. Zakres

- W zakresie: trzy rodzaje maili automatycznych, zgoda marketingowa i jej wycofanie jednym kliknięciem,
  ustawienia powiadomień w koncie, panel administratora (lista, szczegóły, wiadomość do użytkownika).
- Poza zakresem (świadomie): kampanie masowe pisane ręcznie przez właściciela, edytor szablonów, statystyki
  otwarć i kliknięć (piksele śledzące wymagałyby osobnej zgody), zmiana kredytów z panelu.

## 3. Decyzje produktowe

- **Podstawa prawna.** Przypomnienie o darmowych kredytach i mail o stylach sezonowych to informacja handlowa
  (Prawo komunikacji elektronicznej, RODO art. 6 ust. 1 lit. a): wysyłamy je wyłącznie po uprzedniej zgodzie.
  Zgoda jest dobrowolna, niezaznaczona domyślnie, zapisywana z datą (`marketingConsentAt`), do wycofania w
  ustawieniach konta i linkiem w każdej takiej wiadomości. Konta sprzed wdrożenia nie mają zgody.
  Powiadomienie o zakończeniu paczki dotyczy zleconej usługi (wiadomość transakcyjna) – domyślnie włączone,
  do wyłączenia w ustawieniach.
- **Przypomnienie o darmowych kredytach** – jeden raz na konto: konto potwierdzone (13), zgoda, co najmniej
  3 doby od rejestracji, nie starsze niż 30 dni, w darmowej puli zostały kredyty.
- **Styl sezonowy** – jeden mail na sezon i rok (klucz `season:<id>:<rok>`): w pierwszych 7 dniach okna
  sezonu stylu (05), do kont potwierdzonych ze zgodą.
- **Koniec paczki** – masowe przesyłanie z generowaniem dla co najmniej 3 zdjęć rejestruje „paczkę”. Gdy
  żadna grafika tych zdjęć nie jest już w toku, wysyłamy jeden mail z liczbą gotowych i nieudanych grafik
  i linkiem do galerii. Paczki nieukończone po 24 h są zamykane bez maila.
- **Harmonogram**: zadanie co 2 min (paczki) i co 15 min (przypomnienia, sezon), maks. 50 maili na przebieg.
  Maile marketingowe tylko w godzinach 9:00–20:00 czasu polskiego. Każda wysyłka zapisana w `email_log`
  z unikalnym kluczem (konto + klucz) – restart ani drugi przebieg nie wyślą duplikatu.
- **Wypisanie**: link `/unsubscribe?token=…` (token JWT z celem `unsubscribe`, bez wygasania, nie działa
  jako sesja) oraz nagłówki `List-Unsubscribe` i `List-Unsubscribe-Post` (one-click, RFC 8058).
- **Panel administratora** dla adresów z `ADMIN_EMAILS` (na produkcji: właściciel). Lista kont: adres,
  data rejestracji, potwierdzenie, sposób logowania, liczba zdjęć i gotowych grafik, plan, kredyty
  (zakupione saldo i wykorzystana darmowa pula), suma płatności, zgoda marketingowa, ostatnia aktywność.
  Wyszukiwanie po adresie i nazwie, 20 na stronę. Szczegóły: płatności i historia wysłanych maili.
- **Wiadomość do użytkownika** – indywidualna wiadomość od właściciela (temat 3–150, treść 10–5000 znaków),
  wysyłana z `no-reply@allgrafika.pl` z `Reply-To` na adres administratora, zapisana w historii. Panel
  przypomina, że to nie jest kanał do promocji – te wymagają zgody, którą panel pokazuje.

## 4. Przepływ użytkownika (UX)

- Rejestracja: pod akceptacją regulaminu opcjonalne pole „Chcę dostawać wskazówki i przypomnienia
  (np. o niewykorzystanych darmowych kredytach i stylach sezonowych). Zgodę mogę wycofać w każdej chwili.”
- Konto → „Powiadomienia e-mail”: dwa przełączniki (wskazówki i przypomnienia; koniec dużej paczki), zapis
  od razu z toastem.
- `/unsubscribe?token=…` (publiczna, `AuthLayout`): potwierdzenie wypisania albo błąd linku.
- Nawigacja: pozycja „Admin” tylko dla administratora. `/admin`: kafelki przeglądu, wyszukiwarka, tabela
  (na telefonie przewijana poziomo), kliknięcie wiersza otwiera okno szczegółów z historią i formularzem
  wiadomości.

## 5. Wymagania funkcjonalne

- **FR-NOT-001** – Maile automatyczne: przypomnienie o darmowych kredytach, style sezonowe, koniec paczki.
- **FR-ADM-002** – Panel administratora z listą kont, szczegółami i wiadomością do użytkownika.

## 6. Kryteria akceptacji

- **AC-NOT-001** – Given rejestracja z zaznaczoną zgodą / bez zgody / przez Google, When konto powstaje, Then `marketingConsentAt` jest ustawione tylko w pierwszym przypadku, a `notifyBatchDone` jest włączone.
- **AC-NOT-002** – Given zalogowany użytkownik, When zmienia przełączniki w ustawieniach, Then `/users/me` zwraca `marketingConsent` i `notifyBatchDone` zgodnie z wyborem, a włączenie zgody zapisuje datę.
- **AC-NOT-003** – Given konto spełniające warunki przypomnienia, When zadanie działa dwa razy w godzinach wysyłki, Then wysłany jest dokładnie jeden mail z linkiem do aplikacji i linkiem wypisania; konta bez zgody, niepotwierdzone, młodsze niż 3 doby, starsze niż 30 dni, bez darmowych kredytów albo poza godzinami 9–20 nie dostają nic.
- **AC-NOT-004** – Given dzień w pierwszych 7 dniach okna stylu sezonowego, When zadanie działa dwa razy, Then każde potwierdzone konto ze zgodą dostaje jeden mail o tym stylu; poza tym okresem i bez zgody – nic.
- **AC-NOT-005** – Given zarejestrowana paczka (≥ 3 własne zdjęcia), When grafiki są w toku, Then nic; When wszystkie skończone, Then jeden mail z liczbą gotowych i nieudanych grafik; przy wyłączonym powiadomieniu paczka jest zamykana bez maila; mniej niż 3 zdjęcia → 400, cudze zdjęcie → 404.
- **AC-NOT-006** – Given link wypisania, When `POST /notifications/unsubscribe?token=` (także one-click bez sesji), Then zgoda jest wycofana; zły token → 400; mail marketingowy zawiera link i nagłówki `List-Unsubscribe` oraz `List-Unsubscribe-Post`; token wypisania nie działa jako sesja.
- **AC-NOT-007** – Given aplikacja, When użytkownik rejestruje się z polem zgody, przełącza powiadomienia w koncie i otwiera link wypisania, Then pole jest domyślnie niezaznaczone i wysyłane w rejestracji, przełączniki zapisują się, a strona wypisania potwierdza wycofanie zgody.
- **AC-NOT-008** – Given masowe przesyłanie z generowaniem dla ≥ 3 zdjęć, When partia się kończy, Then aplikacja rejestruje paczkę z identyfikatorami zdjęć; tryb „tylko prześlij” i mniejsze partie jej nie rejestrują.
- **AC-ADM-002** – Given konto spoza `ADMIN_EMAILS`, When wywołuje endpointy panelu, Then 403; `/users/me` zwraca `isAdmin=true` tylko administratorowi.
- **AC-ADM-003** – Given konta z grafikami, płatnościami i planem, When lista z wyszukiwaniem i stronicowaniem, Then wiersze mają adres, potwierdzenie, sposób logowania, liczbę zdjęć i gotowych grafik, plan, kredyty, sumę płatności i zgodę, posortowane od najnowszych.
- **AC-ADM-004** – Given konto, When szczegóły, Then są płatności i historia maili; nieznane id → 404.
- **AC-ADM-005** – Given administrator, When wysyła wiadomość do użytkownika, Then mail idzie na adres konta z `Reply-To` administratora, treść jest bezpiecznie zakodowana w HTML, wpis trafia do historii; za krótki temat lub treść → 400.
- **AC-ADM-006** – Given administrator w aplikacji, When otwiera „Admin”, szuka konta, otwiera szczegóły i wysyła wiadomość, Then widzi dane konta i potwierdzenie wysyłki; zwykły użytkownik nie widzi pozycji „Admin”.

## 7. API

- `POST /notifications/batches {imageIds: string[3..50]}` (JWT) → 201 `{id}`.
- `POST /notifications/unsubscribe?token=…` (publiczny, akceptuje też `application/x-www-form-urlencoded` z `List-Unsubscribe=One-Click`) → 200 `{unsubscribed: true}`.
- `PATCH /users/me {name?, marketingConsent?, notifyBatchDone?}`; `GET /users/me` + `marketingConsent`, `notifyBatchDone`, `isAdmin`.
- `POST /auth/register` + opcjonalne `marketingConsent: boolean`.
- `GET /admin/users?search&page&limit`, `GET /admin/users/:id`, `POST /admin/users/:id/email {subject, message}` (JWT + administrator).

## 8. Dane i migracje

Migracja `20261005090000_notifications_admin`: `users.marketingConsentAt TIMESTAMP NULL`,
`users.notifyBatchDone BOOLEAN NOT NULL DEFAULT true`; tabele `email_log (id, userId FK cascade, kind, key,
subject, body NULL, sentBy NULL, createdAt; UNIQUE(userId, key))` i `notification_batches (id, userId FK
cascade, imageIds TEXT[], createdAt, closedAt NULL, notifiedAt NULL)`. Istniejące konta: brak zgody,
powiadomienia o paczkach włączone.

## 9. Wymagania niefunkcjonalne

- Maile z `no-reply@allgrafika.pl` (SPF, DKIM, DMARC – 13). Błąd SMTP nie zapisuje wpisu w `email_log`
  (następny przebieg ponowi), zadanie nie przerywa się na jednym błędzie.
- Panel nie pokazuje haseł ani tokenów; dane osobowe tylko dla administratora (RODO art. 32).

## 10. Wpływ na dokumenty

Polityka prywatności: cel „informacje handlowe e-mailem” na podstawie zgody, powiadomienia o paczkach na
podstawie umowy, okres przechowywania historii maili. Regulamin: powiadomienia i ich wyłączanie.

## 12. Plan testów

AC-NOT-001..006, AC-ADM-002..005 integracyjne (zegar zadań wstrzykiwany, fałszywa poczta); AC-NOT-007..008
i AC-ADM-006 przeglądarkowe.
