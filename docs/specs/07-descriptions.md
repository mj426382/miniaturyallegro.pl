# 07 – Opis oferty pod SEO Allegro

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |
| Powiązane | FR-DESC-001, 02 (AC-PRC-006/007), NFR-LAW-004, NFR-SEC-004, ADR-0004 |

## 1. Problem i cel

Sprzedawca ma grafiki, ale opis pisze godzinami albo kopiuje od konkurencji. Chcemy dać gotowy tytuł,
opis i frazy w formacie Allegro w kilkanaście sekund, z kontrolą nad treścią.

## 2. Decyzje

- Dostępny tylko dla zdjęcia z co najmniej jedną gotową grafiką (409 w innym razie).
- Wejście: notatki sprzedawcy (≤ 2000 znaków) + angielska analiza zdjęcia z cache. Model gpt-4o-mini,
  JSON `{title, body, keywords}`. Prompt zabrania zmyślania parametrów, linków, kontaktu, superlatyw bez pokrycia.
- Wyjście: tytuł ≤ 75 znaków (limit Allegro, przycięty na granicy słowa), HTML tylko z `h2/p/ul/ol/li/b`
  (sanitizer po stronie serwera i w podglądzie), 8–15 fraz małymi literami.
- Cennik: pierwszy opis gratis; każde wywołanie AI (poprawka promptem, „napisz od nowa”) = 1 poprawka;
  5 gratis na zdjęcie (`DESCRIPTION_PROMPT_EDITS`), pakiety po 15 za 1 kredyt; licznik rezerwowany
  atomowo, nieudane wywołania nie liczą się; edycja ręczna bez limitu.
- UI: panel pod wynikami, zakładki Podgląd / Edytuj HTML, licznik znaków tytułu, frazy po przecinku,
  „Cofnij ostatnią poprawkę”, kopiowanie tytułu / HTML / tekstu, „Dokup 15 poprawek (1 kredyt)”.
  Po pierwszej gotowej grafice toast zachęca do opisu. Galeria pokazuje „Opis ✓”.
- Ostrzeżenie w UI i regulaminie: użytkownik weryfikuje fakty przed publikacją.

## 3. API

`GET /descriptions/:imageId` → `{ description|null, promptEditsLimit, promptEditsLeft, canCreate, creditCost: 0, editPackSize: 15, editPackCredits: 1 }`;
`POST /descriptions/:imageId {notes?}` (201; 409 bez grafiki; 402 `EDIT_PACK_REQUIRED` przy ponownym bez poprawek; 503 gdy model zawiedzie);
`PATCH /descriptions/:imageId {title, body, keywords?}`; `POST /descriptions/:imageId/refine {instruction}`;
`POST /descriptions/:imageId/edit-packs` (1 kredyt, 402 bez kredytów).

## 4. Kryteria akceptacji

- **AC-DESC-001** – Given zdjęcie bez gotowej grafiki, When żądanie opisu, Then 409; po gotowej grafice opis powstaje bez pobrania kredytu, HTML jest zsanityzowany (tylko dozwolone tagi, bez atrybutów/skryptów), frazy małymi literami bez duplikatów, notatki zapisane; lista zdjęć ma `hasDescription=true` bez treści opisu.
- **AC-DESC-002** – Given awaria modelu, When pierwszy opis, Then 503 i brak wiersza opisu, kredyty bez zmian.
- **AC-DESC-003** – Given opis, When 4 poprawki promptem i „napisz od nowa”, Then licznik spada do 0 (nieudana poprawka nie liczy się); kolejna poprawka → 402 `EDIT_PACK_REQUIRED`; zakup pakietu pobiera 1 kredyt i daje 15 poprawek; pakiety się sumują; bez kredytów zakup → 402.
- **AC-DESC-004** – Given edycja ręczna, When zapis z brudnym HTML i tytułem ze spacjami, Then zapisany jest tytuł przycięty i HTML zsanityzowany, frazy znormalizowane; tytuł > 75 znaków, za krótki opis lub nieznane pole → 400; licznik poprawek bez zmian.
- **AC-DESC-005** – Given opis innego użytkownika, When odczyt/edycja/poprawka/pakiet, Then 403; po usunięciu zdjęcia opis znika.
- **AC-DESC-006** – Given dowolny HTML, When sanitizacja, Then zostają tylko `h2/p/ul/ol/li/b` bez atrybutów; `h1/h3→h2`, `strong→b`; skrypty, linki, obrazy usunięte.
- **AC-DESC-007** – Given luźne `<` i komentarze, When sanitizacja, Then `<` jest zakodowane, komentarze usunięte.
- **AC-DESC-008** – Given HTML opisu, When konwersja na tekst, Then nagłówki i punkty listy stają się czytelnymi liniami, encje zdekodowane.
- **AC-DESC-009** – Given tytuł > 75 znaków, When przycinanie, Then wynik ≤ 75 znaków, ucięty na granicy słowa, bez markupu.
- **AC-DESC-010** – Given lista fraz, When normalizacja, Then małe litery, bez duplikatów i markupu, max 20.
- **AC-DESC-011** – Given panel opisu, When użytkownik wygeneruje opis z notatek, poprawi promptem, cofnie i zapisze edycję ręczną, Then właściwe endpointy są wołane, licznik spada z 5 do 4, tytuł > 75 blokuje zapis, HTML jest zsanityzowany przed wysłaniem.
- **AC-DESC-012** – Given wyczerpane darmowe poprawki, When użytkownik dokupi pakiet, Then licznik pokazuje 15 z 20, a przycisk poprawki znów działa.
- **AC-DESC-013** – Given sformatowany HTML z edytora, When kompaktowanie, Then wraca do postaci serwerowej (bez białych znaków między tagami), więc „Zapisz zmiany” jest nieaktywne bez realnej zmiany.
