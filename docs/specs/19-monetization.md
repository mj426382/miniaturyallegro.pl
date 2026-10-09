# 19 – Monetyzacja: pula darmowa, pakiet powitalny, oferta przy braku kredytów

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-09 |
| Powiązane | FR-MON-001, spec 02 (cennik), spec 09 (płatności), spec 16 (admin), NFR-LAW-005 |

## 1. Problem i cel

Analiza z 2026-10-09 (tylko dane zagregowane):

- 27 osób, z czego 36 kont wygenerowało grafiki. Mediana to 6 grafik na osobę.
- 25 osób odeszło z 5–9 zużytymi darmowymi grafikami, nie dochodząc do płatności.
- 8 osób zużyło pulę i utknęło na zerze. Żadna nie dostała oferty.
- Jedyna obca próba zakupu odpadła na nieprawidłowym kodzie BLIK i nie było ponowienia.
- Zgodę na maile ma 1 osoba.

Cel: przesunąć użytkowników do pierwszego zakupu bez odbierania obiecanych darmowych grafik.

## 2. Decyzje produktowe (właściciel, 2026-10-09)

- **Darmowa pula**:
  - Nowe konta dostają 5 darmowych grafik (konfiguracja `FREE_CREDITS_LIMIT`).
  - Konta założone wcześniej zachowują 10.
  - Limit jest zapisany na koncie (`users.freeCreditsLimit`) w chwili rejestracji, więc zmiana
    konfiguracji nie zmienia puli istniejących kont.
- **Pakiet powitalny**:
  - 5 kredytów za 5 zł (zwykle 10 zł), wyłącznie przy pierwszym zakupie.
  - Dotyczy kont bez żadnej opłaconej transakcji. Serwer sprawdza warunek przy tworzeniu płatności.
  - Nie jest widoczny w publicznym katalogu pakietów.
- **Oferta w momencie braku kredytów**:
  - Gdy użytkownikowi (nie administratorowi) brakuje kredytów na wybrane grafiki, przycisk
    generowania otwiera okno z ofertą zamiast wysyłać żądanie.
  - Okno pokazuje pakiet powitalny (jeśli dostępny) i zwykłe pakiety oraz zgodę z art. 38 pkt 13
    przed przyciskiem płatności.
  - To samo okno otwiera się po odpowiedzi 402 z API.
  - Działa w generatorze i przy masowym przesyłaniu.
- **Ponowienie płatności**:
  - Po powrocie z anulowanej lub nieudanej płatności strona Kredyty pokazuje baner: kod BLIK jest
    ważny 2 minuty, można zapłacić kartą.
  - Przycisk „Spróbuj ponownie” tworzy nową sesję dla tego samego pakietu.
  - Metody płatności (BLIK, karta, Przelewy24) ustawia się w panelu Stripe: to krok właściciela,
    bo konto Stripe jest współdzielone ze sklepem JAN-MAT.
- **Zgoda marketingowa**:
  - Lepszy tekst zgody przy rejestracji: korzyść (zniżki, przypomnienia o sezonowych stylach,
    bez spamu, wypis jednym kliknięciem). Pole pozostaje domyślnie odznaczone.
  - Na dashboardzie oraz w generatorze zaraz po pierwszych gotowych grafikach (moment największej
    satysfakcji) jednorazowa karta „Chcesz dostawać zniżki i porady?” z przyciskiem włączającym
    zgodę. Nigdy przed generowaniem: zgoda nie może być warunkiem usługi (art. 7 ust. 4 RODO). Wyraźne działanie użytkownika to ważna zgoda (art. 6 ust. 1 lit. a, art. 7 RODO).
  - Karta znika po decyzji (tak lub nie, zapamiętane lokalnie).
- **Kredyty w prezencie od administratora**:
  - W szczegółach konta panelu admina jest przycisk „Dodaj kredyty” (1–100, z powodem).
  - Każde dodanie jest zapisane w `credit_grants` z adresem administratora i widoczne w historii konta.

## 3. Kryteria akceptacji

- **AC-MON-001** – Given konfiguracja `FREE_CREDITS_LIMIT=5`, When powstaje nowe konto (e-mail lub Google), Then ma pulę 5 darmowych grafik; konto założone przed zmianą zachowuje 10, a `/users/me` zwraca `freeCreditsLimit` konta.
- **AC-MON-002** – Given konto bez opłaconej transakcji, When pobiera ofertę powitalną i tworzy płatność `welcome_5`, Then dostaje sesję Stripe na 5 zł za 5 kredytów; konto z opłaconą transakcją dostaje `available=false` i 400 przy próbie zakupu, a pakiet nie występuje w publicznym katalogu.
- **AC-MON-003** – Given użytkownik bez wystarczających kredytów w generatorze lub przy masowym przesyłaniu, When kliknie generowanie albo API zwróci 402, Then widzi okno z pakietem powitalnym (jeśli dostępny) i pakietami. Przycisk płatności wymaga zgody z art. 38 pkt 13 i tworzy sesję dla wybranego pakietu. Administrator okna nie widzi.
- **AC-MON-004** – Given powrót z anulowanej płatności, When strona Kredyty się otworzy, Then baner wyjaśnia ważność kodu BLIK i alternatywę kartą, a „Spróbuj ponownie” tworzy nową sesję dla tego samego pakietu.
- **AC-MON-005** – Given rejestracja, When formularz się wyświetla, Then zgoda marketingowa opisuje korzyść i możliwość wypisania i jest odznaczona. Given zalogowany użytkownik bez zgody, When otwiera dashboard, Then widzi kartę z przyciskiem włączającym zgodę (także w generatorze, gdy są gotowe grafiki, a nigdy przed pierwszym generowaniem), a po decyzji karta znika wszędzie.
- **AC-MON-006** – Given administrator, When doda kredyty kontu (1–100, z powodem), Then saldo rośnie o tę liczbę, wpis trafia do `credit_grants` i historii konta, a konto spoza `ADMIN_EMAILS` dostaje 403.
- **AC-MON-007** – Given strona główna, regulamin i aplikacja, When są wyświetlane, Then komunikują 5 darmowych grafik dla nowych kont, a regulamin zachowuje 10 dla kont założonych przed datą zmiany.
