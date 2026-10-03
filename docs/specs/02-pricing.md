# 02 – Cennik i model kredytów

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |
| Powiązane | 05, 06, 07, 09; regulamin § 4; `backend/src/payments/plans.ts`; `src/legal/entity.ts` (`PRICING`) |

## Decyzje

| Pozycja | Zasada | Uzasadnienie |
|---|---|---|
| Darmowe kredyty | 10 na nowe konto (`FREE_CREDITS_LIMIT`), bez karty | Aktywacja; koszt ≈ 1,70 zł na konto |
| Grafika | 1 kredyt za 1 grafikę w dowolnym stylu, własny styl i przeróbka też 1 kredyt | Prosta jednostka |
| Zestaw startowy | 3 style oznaczone `starter` = 3 kredyty; reszta na życzenie | Ochrona budżetu klienta i nasz koszt AI |
| Nieudana generacja | Kredyt wraca automatycznie (błąd techniczny, reconciler) | Zaufanie |
| Eksport | Bez opłat: formaty, kadr, obrót, korekta, plakietka | Deterministyczne, bez AI |
| Opis oferty | Pierwszy opis dla zdjęcia **gratis** po wygenerowaniu grafiki; 5 poprawek AI gratis na zdjęcie; kolejne pakiety po 15 poprawek za 1 kredyt (wielokrotnie); „napisz od nowa” = 1 poprawka; edycja ręczna bez limitu | Koszt AI ≈ 0,003 zł na wywołanie; opis to wabik i wartość dodana |
| Pakiety | 5 kr / 10 zł, 15 kr / 28 zł, 40 kr / 70 zł (brutto) | Niska bariera wejścia |
| Abonamenty | Start 49 zł / 40 kr mies., Pro 149 zł / 150 kr mies.; kredyty nie wygasają | Sklepy z wieloma SKU |
| Demo bez konta | 1 grafika na e-mail, 2 na IP dziennie | Pozyskanie leadów |

## Ekonomika jednostkowa (do aktualizacji przy zmianie cen dostawców)

| Pozycja | Wartość |
|---|---|
| Koszt Gemini 2.5 Flash Image za grafikę | ≈ 0,15 zł |
| Koszt OpenAI (opis zdjęcia, prompty) | ≈ 0,01 zł |
| Koszt opisu oferty z 5 poprawkami | ≈ 0,02 zł |
| Przychód netto za kredyt (pakiet 10 zł, po VAT i Stripe) | ≈ 1,40 zł |
| Przychód netto za kredyt (abonament Pro) | ≈ 0,79 zł |
| Marża brutto na grafice | 78–88 % |

## Zasady zmian

- Zmiana ceny lub limitu = PR zmieniający ten plik, `plans.ts`/`PRICING`, obie kopie regulaminu i landing.
- Nowa opłata za coś dotąd darmowego wymaga 14-dniowego powiadomienia użytkowników (regulamin § 2).

## Kryteria akceptacji

- **AC-PRC-001** – Given nowe konto, When zostanie utworzone, Then ma 10 darmowych kredytów i 0 zakupionych.
- **AC-PRC-002** – Given konto z darmowymi kredytami, When uruchomi zestaw startowy, Then pobierane są dokładnie 3 kredyty, najpierw z darmowej puli.
- **AC-PRC-003** – Given brak wystarczających kredytów, When użytkownik próbuje generować, Then odpowiedź 402 i nic nie jest tworzone ani pobierane.
- **AC-PRC-004** – Given generacja zakończona błędem po stronie serwisu, When zostanie oznaczona jako nieudana, Then kredyt wraca na konto (najpierw darmowy).
- **AC-PRC-005** – Given gotowa grafika, When użytkownik eksportuje ją w dowolnym formacie, Then nie są pobierane kredyty.
- **AC-PRC-006** – Given zdjęcie z gotową grafiką, When użytkownik generuje pierwszy opis, Then nie są pobierane kredyty.
- **AC-PRC-007** – Given wykorzystane 5 darmowych poprawek, When użytkownik dokupi pakiet, Then pobierany jest 1 kredyt i limit rośnie o 15; bez pakietu kolejna poprawka zwraca 402 z kodem `EDIT_PACK_REQUIRED`.
