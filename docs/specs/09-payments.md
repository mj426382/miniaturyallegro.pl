# 09 – Płatności: pakiety, abonamenty, webhooki

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |
| Powiązane | FR-PAY-001, 02, NFR-LAW-002, NFR-REL-002, regulamin § 4 |

## 1. Decyzje

- Stripe Checkout dla pakietów (jednorazowo) i Stripe Billing dla abonamentów (price ID z env; plan
  oferowany tylko, gdy skonfigurowany). Billing Portal do anulowania.
- Przed zakupem pakietu użytkownik zaznacza żądanie natychmiastowego udostępnienia i utratę prawa
  odstąpienia (art. 38 pkt 13); przed abonamentem zgodę z art. 35. Bez zgody → 400.
- Webhook: weryfikacja podpisu i `livemode`; kredyty dodawane dokładnie raz na sesję/fakturę
  (idempotencja po id); `invoice.paid` tylko dla `subscription_create|subscription_cycle` (proraty nie
  dają kredytów); plan rozpoznawany po zafakturowanej cenie; nieopłacone/wygasłe sesje oznaczane.
- Usunięcie konta anuluje aktywny abonament.
- Kredyty nie wygasają; historia transakcji widoczna w aplikacji.

## 2. API

`GET /payments/packages|plans|history|subscription`, `POST /payments/checkout {packageId, acceptedWithdrawalWaiver}`,
`POST /payments/subscribe {planId, acceptedEarlyStart}`, `POST /payments/portal`, `POST /payments/webhook` (raw body).

## 3. Kryteria akceptacji

- **AC-PAY-001** – Given dowolny klient, When `GET /payments/packages`, Then lista pakietów z cenami bez logowania.
- **AC-PAY-002** – Given brak zgody konsumenckiej, When checkout, Then 400 i brak sesji Stripe.
- **AC-PAY-003** – Given zgoda, When checkout, Then powstaje sesja Stripe i transakcja `pending`.
- **AC-PAY-004** – Given webhook `checkout.session.completed` dwa razy, When przetworzony, Then kredyty dodane dokładnie raz.
- **AC-PAY-005** – Given `checkout.session.async_payment_failed`, When przetworzony, Then transakcja oznaczona jako nieudana.
- **AC-PAY-006** – Given nieopłacona sesja, When webhook, Then nic nie dodaje; wygasła → oznaczona.
- **AC-PAY-007** – Given plany, When listowane, Then mają flagę dostępności; subskrypcja startuje sesję z właściwą ceną.
- **AC-PAY-008** – Given faktura proraty lub zmiany planu, When webhook, Then kredyty nie są dodane; plan rozpoznany po zafakturowanej cenie.
- **AC-PAY-009** – Given webhook z innym `livemode` niż klucz, When przetworzony, Then jest ignorowany.
- **AC-PAY-010** – Given aktywny abonament, When konto jest usuwane, Then abonament jest anulowany w Stripe.
- **AC-PAY-011** – Given strona kredytów, When użytkownik kliknie „Kup” bez zgody, Then widzi wskazówkę; ze zgodą i podwójnym kliknięciem powstaje dokładnie jedna sesja.
