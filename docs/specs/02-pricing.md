# 02 – Cennik i model kredytów

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-04 |
| Powiązane | 05, 06, 07, 09; regulamin § 4; `backend/src/payments/plans.ts`; `src/legal/entity.ts` (`PRICING`) |

## Decyzje

| Pozycja | Zasada | Uzasadnienie |
|---|---|---|
| Darmowe kredyty | 5 na nowe konto (konta sprzed 2026-10-09: 10, spec 19) (`FREE_CREDITS_LIMIT`), bez karty, do wykorzystania po potwierdzeniu adresu e-mail; jedna pula na skrzynkę (adres kanoniczny, 13) | Aktywacja; koszt ≈ 1,70 zł na konto; ochrona przed seryjnymi kontami |
| Grafika | 1 kredyt za 1 grafikę w dowolnym stylu, własny styl i przeróbka też 1 kredyt | Prosta jednostka |
| Zestaw startowy | 3 style oznaczone `starter` = 3 kredyty; reszta na życzenie | Ochrona budżetu klienta i nasz koszt AI |
| Nieudana generacja | Kredyt wraca automatycznie (błąd techniczny, reconciler) do tej puli, z której został pobrany (darmowa albo kupiona) | Zaufanie; poprawne saldo kupionych kredytów przy odstąpieniu (19, 09) |
| Eksport | Bez opłat: formaty, kadr, obrót, korekta, plakietka | Deterministyczne, bez AI |
| Infografiki | Bez opłat: szablony cech i wymiarów (14) | Render bez AI |
| Paczka ZIP | Bez opłat (15) | Brak kosztu po naszej stronie poza transferem |
| Style sezonowe i branżowe | Jak każda grafika: 1 kredyt | Ten sam koszt AI |
| Opis oferty | Pierwszy opis dla zdjęcia **gratis** po wygenerowaniu grafiki; 5 poprawek AI gratis na zdjęcie; kolejne pakiety po 15 poprawek za 1 kredyt (wielokrotnie); „napisz od nowa” = 1 poprawka; edycja ręczna bez limitu | Koszt AI ≈ 0,003 zł na wywołanie; opis to wabik i wartość dodana |
| Pakiety | 5 kr / 10 zł, 15 kr / 28 zł, 40 kr / 70 zł, 200 kr / 99 zł (brutto; od 2026-10-09) | Niska bariera wejścia; duży pakiet 0,50 zł/grafika dla sklepów z wieloma produktami – opłata stała Stripe (ok. 1 zł) rozkłada się na 200 grafik, marża ok. 38 zł |
| Abonamenty | Start 19 zł / 40 kr mies. (0,48 zł / grafikę), Pro 59 zł / 150 kr mies. (0,39 zł / grafikę); kredyty nie wygasają (decyzja właściciela 2026-10-17: niższe ceny abonamentów). Grafika w każdym planie jest tańsza niż w najtańszym pakiecie (200 kr / 99 zł = 0,50 zł). Plan jest oferowany tylko wtedy, gdy jego cena w Stripe jest miesięczna, w PLN i równa cenie z `plans.ts` (09) | Sklepy z wieloma SKU; abonament musi się opłacać bardziej niż największy pakiet |
| Kody rabatowe | Procentowe (1–100%) albo kwotowe (zł) kody promocyjne Stripe dla partnerów, tworzone w panelu administratora (16); działają na zwykłe pakiety i – jednorazowo – na pierwszą płatność abonamentu, nie na pakiet powitalny; kredyty zawsze w pełnej liczbie pakietu (09). Cennik się nie zmienia | Pozyskanie klientów przez partnerów (np. katalog firm) bez obniżania cen dla wszystkich |
| Demo bez konta | 1 grafika na e-mail, 2 na IP dziennie | Pozyskanie leadów |

## Ekonomika jednostkowa (do aktualizacji przy zmianie cen dostawców)

| Pozycja | Wartość |
|---|---|
| Koszt Gemini 2.5 Flash Image za grafikę | ≈ 0,15 zł |
| Koszt OpenAI (opis zdjęcia, prompty) | ≈ 0,01 zł |
| Koszt opisu oferty z 5 poprawkami | ≈ 0,02 zł |
| Przychód netto za kredyt (pakiet 10 zł, po VAT i Stripe) | ≈ 1,40 zł |
| Przychód netto za kredyt (abonament Start 19 zł, po VAT i Stripe) | ≈ 0,35 zł |
| Przychód netto za kredyt (abonament Pro 59 zł, po VAT i Stripe) | ≈ 0,31 zł |
| Marża brutto na grafice | ok. 48 % (Pro) – 88 % (pakiet 5 kr) |

## Zasady zmian

- Zmiana ceny lub limitu = PR zmieniający ten plik, `plans.ts`/`PRICING`, obie kopie regulaminu i landing.
- Nowa opłata za coś dotąd darmowego wymaga 14-dniowego powiadomienia użytkowników (regulamin § 2).

## Kryteria akceptacji

- **AC-PRC-001** – Given nowe konto, When zostanie utworzone, Then ma zapisaną na koncie darmową pulę z `FREE_CREDITS_LIMIT` – domyślnie 5 (tyle dostają nowe konta na produkcji od 2026-10-09, spec 19) – i 0 zakupionych kredytów.
- **AC-PRC-002** – Given konto z darmowymi kredytami, When uruchomi zestaw startowy, Then pobierane są dokładnie 3 kredyty, najpierw z darmowej puli.
- **AC-PRC-003** – Given brak wystarczających kredytów, When użytkownik próbuje generować, Then odpowiedź 402 i nic nie jest tworzone ani pobierane.
- **AC-PRC-004** – Given generacja zakończona błędem po stronie serwisu, When zostanie oznaczona jako nieudana, Then kredyt wraca na konto do tej puli, z której został pobrany (szczegóły: AC-GEN-027).
- **AC-PRC-005** – Given gotowa grafika, When użytkownik eksportuje ją w dowolnym formacie, Then nie są pobierane kredyty.
- **AC-PRC-006** – Given zdjęcie z gotową grafiką, When użytkownik generuje pierwszy opis, Then nie są pobierane kredyty.
- **AC-PRC-008** – Given gotowa grafika, When użytkownik tworzy infografikę albo pobiera paczkę ZIP, Then nie są pobierane kredyty.
- **AC-PRC-009** – Given publiczny katalog pakietów, When pobrany, Then zawiera pakiet 200 kredytów za 99 zł (0,50 zł za grafikę) obok pakietów 5/15/40, a zakup tworzy sesję Stripe na 99 zł i dodaje 200 kredytów po płatności.
- **AC-PRC-007** – Given wykorzystane 5 darmowych poprawek, When użytkownik dokupi pakiet, Then pobierany jest 1 kredyt i limit rośnie o 15; bez pakietu kolejna poprawka zwraca 402 z kodem `EDIT_PACK_REQUIRED`.
- **AC-PRC-010** – Given katalog abonamentów, When pobrany, Then Start kosztuje 19 zł za 40 kredytów miesięcznie, a Pro 59 zł za 150; cena za grafikę każdego planu jest niższa niż w każdym pakiecie (najtańszy: 200 kr / 99 zł = 0,50 zł), a etykiety i opisy podają cenę za grafikę wyliczoną z ceny i liczby kredytów (0,48 zł i 0,39 zł).
