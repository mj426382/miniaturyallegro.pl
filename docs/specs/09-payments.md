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
- **Strażnik ceny planu** (2026-10-17): plan ma `available: true` tylko wtedy, gdy jego Price w Stripe
  istnieje, jest aktywna, cykliczna co 1 miesiąc, w PLN i ma `unit_amount` równe `priceGrosze` z `plans.ts`.
  Wynik sprawdzenia jest trzymany w pamięci 5 min (błąd Stripe: 1 min). Brak ceny, niezgodność albo błąd
  Stripe → plan niedostępny i ostrzeżenie w logu (fail closed). `POST /payments/subscribe` sprawdza to samo
  i odmawia (400). Strona nigdy nie pokaże 19 zł, gdy Stripe pobierałby inną kwotę.
- Przed zakupem pakietu użytkownik zaznacza żądanie natychmiastowego udostępnienia i utratę prawa
  odstąpienia (art. 38 pkt 13); przed abonamentem zgodę z art. 35. Bez zgody → 400.
- Webhook: weryfikacja podpisu i `livemode`; kredyty dodawane dokładnie raz na sesję/fakturę
  (idempotencja po id); `invoice.paid` tylko dla `subscription_create|subscription_cycle` (proraty nie
  dają kredytów); plan rozpoznawany po zafakturowanej cenie; nieopłacone/wygasłe sesje oznaczane.
- Usunięcie konta anuluje aktywny abonament.
- **Zwroty i chargebacki** (2026-10-17, review produkcji):
  - Przy opłaceniu zapisujemy przy transakcji id PaymentIntent (sesja Checkout: `payment_intent`; faktura
    abonamentu: `payments[].payment.payment_intent` albo stare pole `payment_intent`) i `completedAt`.
  - `charge.refunded` (pełny i częściowy): Stripe podaje narastająco `amount_refunded`. Odbieramy kredyty
    proporcjonalnie: `round(creditsAdded × (zwrócone + kwota sporu) / amountPln)`, najwyżej `creditsAdded`.
    Liczy się tylko przyrost względem już odebranych, więc kolejność zdarzeń nie ma znaczenia, a kredyty
    nigdy nie wracają przez starsze zdarzenie. Status: `partially_refunded` albo `refunded`.
  - `charge.dispute.created`: tak samo dla kwoty sporu, status `disputed`. `charge.dispute.closed`:
    `won` (i `warning_closed`) oddaje odebrane kredyty (najpierw kasuje niedobór), status wraca do
    `completed`/`partially_refunded`; `lost` zostawia `disputed`. Zamknięty spór nie otwiera się ponownie.
  - Saldo nigdy nie spada poniżej 0: czego nie da się odebrać (kredyty już wydane), zapisujemy jako
    `creditsShortfall` przy transakcji. Odbieramy tylko kupione kredyty, nigdy darmowej puli.
  - Zwrot przed realizacją (zdarzenia poza kolejnością): zapisujemy zwrot, a realizacja doda tylko
    `creditsAdded − creditsReversed`.
  - Idempotencja po id zdarzenia Stripe (`stripe_events`, wstawiane w tej samej transakcji co zmiana salda);
    blokada wiersza transakcji, potem konta – równoległe dostarczenia nie zdublują zmian.
  - Dopasowanie: najpierw po PaymentIntent w bazie, potem (transakcje sprzed zmiany) przez Stripe: sesja
    Checkout z tym PaymentIntent albo faktura z tą płatnością (`invoicePayments`). Konto Stripe jest wspólne
    ze sklepem JAN-MAT, więc obce płatności są pomijane bez powiadomień (200). Płatność naszego klienta
    Stripe bez dopasowania: przez pierwsze 6 h odpowiadamy 503 (Stripe ponowi – np. `invoice.paid` jeszcze
    nie doszło), potem alert do administratorów i 200.
  - Każda zmiana z powodu zwrotu lub sporu wysyła mail do adresów z `ADMIN_EMAILS` (MailService, spec 16):
    konto, transakcja, kwoty, odebrane kredyty, niedobór, saldo po zmianie. Błąd wysyłki nie cofa zmian.
  - Zwrot faktury abonamentu działa identycznie na kredytach przyznanych przez tę fakturę.
  - Webhooki do włączenia w Stripe: `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
- Kredyty nie wygasają; historia transakcji widoczna w aplikacji.
- **Faktury z NIP-em (decyzja właściciela: przez Stripe, bez KSeF)**: każda płatność (pakiet i abonament)
  tworzy fakturę Stripe. Checkout pozwala zaznaczyć zakup jako firma z NIP (`tax_id_collection`); adres
  rozliczeniowy jest zbierany tylko wtedy, gdy jest potrzebny (`billing_address_collection: auto` –
  decyzja właściciela 2026-10-14: wymagany adres zniechęcał osoby prywatne przy małym pierwszym pakiecie;
  firma podająca NIP podaje też dane do faktury). Dane trafiają na klienta Stripe (`customer_update`), więc kolejne zakupy je
  pamiętają. Klient Stripe jest tworzony przed pierwszym checkoutem. Id faktury zapisujemy przy
  transakcji; w historii przy płatności jest link „Faktura” (PDF pobierany na żądanie świeżym linkiem
  ze Stripe). Faktury Stripe nie trafiają do KSeF – rozliczenie w KSeF prowadzi księgowość właściciela
  na podstawie raportu Stripe (ryzyko opisane w p. 4).
- **Kody rabatowe** (2026-10-18, prośba właściciela: kody dla partnerów, np. katalogu firm, dla ich
  czytelników):
  - Kody to kody promocyjne Stripe (kupon `duration: once` + kod promocyjny), tworzone i wyłączane
    w panelu administratora (spec 16). Rabat procentowy (1–100%) albo kwotowy w zł (PLN).
  - Checkout zwykłego pakietu ma `allow_promotion_codes: true` – kupujący wpisuje kod na stronie płatności
    Stripe. **Pakiet powitalny kodów nie przyjmuje** (już jest przeceniony, spec 19) – jego sesja nie ma
    `allow_promotion_codes`.
  - Abonament już wcześniej miał `allow_promotion_codes: true` i tego nie zmieniamy: kod z panelu
    (`duration: once`) obniża także **pierwszą płatność abonamentu**; kolejne odnowienia są w pełnej cenie.
    Kredyty abonamentu są jak dotąd przyznawane z `invoice.paid` (`amountPln` = `amount_paid`).
  - Kredyty za pakiet z kodem: zawsze pełna liczba kredytów pakietu, niezależnie od rabatu.
  - Przy realizacji zapisujemy to, co naprawdę zapłacono: `amountPln = amount_total` sesji,
    `amountDiscount = total_details.amount_discount` (grosze) i `promotionCode` – czytelny kod (np.
    `PARTNER-10`), ustalany z `discounts[].promotion_code` sesji (rozwinięty obiekt albo
    `promotionCodes.retrieve`). Błąd Stripe przy ustalaniu kodu nie blokuje realizacji: kredyty są dodane,
    kod zostaje pusty, w logu jest ostrzeżenie; kolejne dostarczenie zdarzenia uzupełnia brakujący kod.
  - Kod 100% (`amount_total = 0`, `payment_status = no_payment_required`) jest realizowany jak opłacona
    sesja (raz, idempotentnie). Inne statusy niż `paid` i `no_payment_required` dalej czekają.
  - Zwroty i spory po zakupie z kodem liczą się od kwoty zapłaconej (`amountPln` po realizacji): pełny
    zwrot zapłaconej kwoty odbiera wszystkie kredyty pakietu. Zwrot zarejestrowany przed realizacją jest
    przeliczany po zapisaniu zapłaconej kwoty. Przychód w panelu (AC-ADM-015) też jest liczony od kwoty
    zapłaconej, więc rabat go pomniejsza automatycznie.
  - Strona Kredyty: pod pakietami krótka informacja „Masz kod rabatowy? Wpiszesz go na stronie płatności
    Stripe.” (nie przy pakiecie powitalnym).
  - Ograniczenie Stripe: najmniejsza płatność w PLN to 2 zł – kod kwotowy, po którym do zapłaty zostaje
    mniej niż 2 zł (ale więcej niż 0), Stripe odrzuci na stronie płatności. Kod 100% działa (zamówienie
    bez płatności).

## 2. API

`GET /payments/packages|plans|history|subscription`, `POST /payments/checkout {packageId, acceptedWithdrawalWaiver}`,
`POST /payments/subscribe {planId, acceptedEarlyStart}`, `POST /payments/portal`, `POST /payments/webhook` (raw body),
`GET /payments/invoices/:transactionId` → `{url}` (JWT, tylko własne transakcje, 404 gdy brak faktury).
Kody rabatowe: `GET|POST /admin/discount-codes`, `POST /admin/discount-codes/:id/deactivate` (spec 16).

Dane: migracja `20261018150000_discount_codes` – `payment_transactions.amountDiscount INT NOT NULL DEFAULT 0`,
`payment_transactions.promotionCode TEXT NULL` i tabela `discount_codes` (spec 16). Tylko dodawanie kolumn i tabeli.

## 3. Ryzyka

- Od 2026 faktury B2B w Polsce muszą być wystawiane w KSeF. Faktury Stripe tam nie trafiają – właściciel
  świadomie wybrał to rozwiązanie; integracja z serwisem księgowym (np. Fakturownia) to osobna zmiana.
- Regulamin nie opisuje jeszcze kodów rabatowych (rabat obniża tylko cenę, zasady kredytów się nie zmieniają) –
  dopisanie zdania o kodach partnerów w § 4 to decyzja właściciela (obie kopie regulaminu, spec 02).
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
- **AC-PAY-012** – Given checkout pakietu albo abonamentu, When sesja Stripe jest tworzona, Then ma klienta Stripe, `tax_id_collection.enabled`, adres rozliczeniowy zbierany tylko w razie potrzeby (`billing_address_collection: auto`, nie `required`), `customer_update` (nazwa i adres) i – dla pakietu – `invoice_creation.enabled`.
- **AC-PAY-013** – Given opłacona sesja z fakturą albo opłacona faktura abonamentu, When webhook, Then id faktury jest zapisane przy transakcji, a historia zwraca `hasInvoice=true`.
- **AC-PAY-014** – Given transakcja z fakturą, When `GET /payments/invoices/:id`, Then zwracany jest aktualny link PDF ze Stripe; transakcja cudza albo bez faktury → 404.
- **AC-PAY-016** – Given opłacona sesja Checkout albo opłacona faktura abonamentu, When webhook, Then przy transakcji zapisane są id PaymentIntent (oba kształty faktury) i `completedAt`, a pakiet ma zapisany `packageId`.
- **AC-PAY-017** – Given opłacony pakiet, When `charge.refunded` częściowy, a potem pełny (także zdublowany i w odwrotnej kolejności), Then kredyty są odbierane proporcjonalnie (narastająco, łącznie dokładnie `creditsAdded`), status to `partially_refunded`, potem `refunded`, każde zdarzenie działa raz, starsze zdarzenie niczego nie oddaje, a administratorzy dostają mail.
- **AC-PAY-018** – Given kupujący wydał już kredyty, When zwrot albo spór, Then saldo spada najwyżej do 0, a brakująca część jest zapisana jako `creditsShortfall`.
- **AC-PAY-019** – Given opłacony pakiet, When `charge.dispute.created`, a potem `charge.dispute.closed` wygrany albo przegrany, Then przy otwarciu kredyty są odbierane i status to `disputed`; wygrana oddaje odebrane kredyty (niedobór kasowany najpierw) i przywraca status, przegrana zostawia `disputed`; zamknięcie przed otwarciem nie otwiera sporu ponownie; każdy krok powiadamia administratorów.
- **AC-PAY-020** – Given opłacona faktura abonamentu, When jej płatność zostaje zwrócona, Then odbierane są kredyty przyznane przez tę fakturę (proporcjonalnie), także dla faktury bez zapisanego PaymentIntent (dopasowanie przez Stripe).
- **AC-PAY-021** – Given zwrot zarejestrowany przed `checkout.session.completed` (zdarzenia poza kolejnością), When sesja zostaje zrealizowana, Then dodawane jest tylko `creditsAdded − creditsReversed` (przy pełnym zwrocie nic), a status zwrotu zostaje.
- **AC-PAY-022** – Given zwrot płatności spoza AllGrafiki (wspólne konto Stripe), When webhook, Then 200, brak zmian i powiadomień; płatność naszego klienta bez dopasowania → 503 przez pierwsze 6 h, potem alert i 200; transakcja sprzed zmiany jest dopasowana przez sesję Checkout ze Stripe.
- **AC-PAY-023** – Given plan z Price w Stripe, When lista planów albo subskrypcja, Then plan jest dostępny tylko przy aktywnej cenie miesięcznej w PLN równej `priceGrosze`; niezgodna kwota, waluta lub interwał, brak ceny albo błąd Stripe → `available: false`, ostrzeżenie i 400 przy subskrypcji; wynik jest cache'owany (jedno zapytanie do Stripe na wiele wywołań).
- **AC-PAY-024** – Given to samo zdarzenie realizacji albo zwrotu dostarczone równolegle wiele razy, When przetworzone, Then kredyty są dodane (odebrane) dokładnie raz.
- **AC-PAY-025** – Given losowa sekwencja operacji kilku kont (zakup – także z kodem rabatowym, w tym 100% – generowanie, błąd ze zwrotem, ponowienie, zwrot i spór w Stripe, zdublowane zdarzenia), When po każdym kroku, Then saldo darmowe i kupione każdego konta równa się księdze (zrealizowane transakcje minus odebrane plus niedobór, minus aktywne generacje z danej puli) i nigdy nie jest ujemne.
- **AC-PAY-026** – Given checkout zwykłego pakietu, When sesja Stripe jest tworzona, Then ma `allow_promotion_codes: true`; sesja pakietu powitalnego nie ma `allow_promotion_codes` (kodu nie da się użyć), a sesja abonamentu dalej ma `allow_promotion_codes: true`.
- **AC-PAY-027** – Given opłacona sesja pakietu z kodem procentowym albo kwotowym, When webhook (także zdublowany), Then kredyty są dodane raz i w pełnej liczbie pakietu, a transakcja ma `amountPln = amount_total`, `amountDiscount = total_details.amount_discount` i `promotionCode` z czytelnym kodem (z rozwiniętego obiektu albo przez `promotionCodes.retrieve`); historia płatności pokazuje kwotę zapłaconą; sesja bez rabatu ma `amountDiscount = 0` i pusty kod.
- **AC-PAY-028** – Given sesja pakietu z kodem 100% (`amount_total = 0`, `payment_status = no_payment_required`), When webhook dwa razy, Then zamówienie jest zrealizowane dokładnie raz (pełne kredyty, `amountPln = 0`, rabat równy cenie pakietu); sesja z `payment_status = unpaid` niczego nie dodaje.
- **AC-PAY-029** – Given opłacona sesja z rabatem, gdy Stripe nie pozwala ustalić kodu (błąd API), When webhook, Then kredyty są dodane, `amountPln` i `amountDiscount` zapisane, `promotionCode` pusty z ostrzeżeniem w logu; kolejne dostarczenie zdarzenia uzupełnia kod bez ponownego dodania kredytów.
- **AC-PAY-030** – Given pakiet kupiony z kodem, When pełny zwrot zapłaconej kwoty, zwrot częściowy, spór albo zwrot zarejestrowany przed realizacją, Then kredyty są odbierane proporcjonalnie do kwoty zapłaconej (pełny zwrot zapłaconej kwoty odbiera wszystkie kredyty pakietu, status `refunded`), a saldo zgadza się z księgą.
- **AC-PAY-031** – Given strona Kredyty z pakietami i ofertą powitalną, When się wyświetla, Then pod pakietami jest informacja „Masz kod rabatowy? Wpiszesz go na stronie płatności Stripe.”, a karta pakietu powitalnego jej nie zawiera.
- **AC-PAY-011** – Given strona kredytów, When użytkownik kliknie „Kup” bez zgody, Then widzi wskazówkę; ze zgodą i podwójnym kliknięciem powstaje dokładnie jedna sesja.
- **AC-PAY-015** – Given historia z płatnością z fakturą, When użytkownik kliknie „Faktura”, Then otwiera się link z API; przy płatności bez faktury przycisku nie ma, a pod pakietami jest informacja, że NIP podaje się w formularzu płatności.
