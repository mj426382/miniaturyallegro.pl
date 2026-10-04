# 09 – Płatności: pakiety, abonamenty, webhooki

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-04 |
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
- **Faktury z NIP-em (decyzja właściciela: przez Stripe, bez KSeF)**: każda płatność (pakiet i abonament)
  tworzy fakturę Stripe. Checkout zbiera adres rozliczeniowy i pozwala zaznaczyć zakup jako firma z NIP
  (`tax_id_collection`); dane trafiają na klienta Stripe (`customer_update`), więc kolejne zakupy je
  pamiętają. Klient Stripe jest tworzony przed pierwszym checkoutem. Id faktury zapisujemy przy
  transakcji; w historii przy płatności jest link „Faktura” (PDF pobierany na żądanie świeżym linkiem
  ze Stripe). Faktury Stripe nie trafiają do KSeF – rozliczenie w KSeF prowadzi księgowość właściciela
  na podstawie raportu Stripe (ryzyko opisane w p. 4).

## 2. API

`GET /payments/packages|plans|history|subscription`, `POST /payments/checkout {packageId, acceptedWithdrawalWaiver}`,
`POST /payments/subscribe {planId, acceptedEarlyStart}`, `POST /payments/portal`, `POST /payments/webhook` (raw body),
`GET /payments/invoices/:transactionId` → `{url}` (JWT, tylko własne transakcje, 404 gdy brak faktury).

## 3. Ryzyka

- Od 2026 faktury B2B w Polsce muszą być wystawiane w KSeF. Faktury Stripe tam nie trafiają – właściciel
  świadomie wybrał to rozwiązanie; integracja z serwisem księgowym (np. Fakturownia) to osobna zmiana.
- W panelu Stripe trzeba uzupełnić dane sprzedawcy (nazwa, NIP, adres) i włączyć wysyłkę faktur e-mailem.

## 4. Kryteria akceptacji

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
- **AC-PAY-012** – Given checkout pakietu albo abonamentu, When sesja Stripe jest tworzona, Then ma klienta Stripe, `tax_id_collection.enabled`, wymagany adres rozliczeniowy, `customer_update` (nazwa i adres) i – dla pakietu – `invoice_creation.enabled`.
- **AC-PAY-013** – Given opłacona sesja z fakturą albo opłacona faktura abonamentu, When webhook, Then id faktury jest zapisane przy transakcji, a historia zwraca `hasInvoice=true`.
- **AC-PAY-014** – Given transakcja z fakturą, When `GET /payments/invoices/:id`, Then zwracany jest aktualny link PDF ze Stripe; transakcja cudza albo bez faktury → 404.
- **AC-PAY-011** – Given strona kredytów, When użytkownik kliknie „Kup” bez zgody, Then widzi wskazówkę; ze zgodą i podwójnym kliknięciem powstaje dokładnie jedna sesja.
- **AC-PAY-015** – Given historia z płatnością z fakturą, When użytkownik kliknie „Faktura”, Then otwiera się link z API; przy płatności bez faktury przycisku nie ma, a pod pakietami jest informacja, że NIP podaje się w formularzu płatności.
