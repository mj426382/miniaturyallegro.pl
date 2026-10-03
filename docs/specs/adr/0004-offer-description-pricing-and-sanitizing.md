# ADR-0004: Opis oferty gratis z limitem poprawek; HTML ograniczony do podzbioru Allegro

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Data | 2026-10-03 |

## Kontekst

Opis oferty kosztuje nas ułamek grosza (gpt-4o-mini), a dla sprzedawcy jest dużą wartością. Trzy
warianty cennika były rozważane: 1 kredyt za opis, 1 kredyt + 10 poprawek, opis gratis. Treść z modelu
i z edytora użytkownika trafia do `dangerouslySetInnerHTML` i do schowka, więc musi być bezpieczna.

## Decyzja

- Pierwszy opis dla zdjęcia jest **gratis** (tylko po gotowej grafice – opis korzysta z analizy zdjęcia).
  Każde wywołanie AI zużywa poprawkę: 5 gratis na zdjęcie, kolejne pakiety po 15 za 1 kredyt. Licznik
  jest rezerwowany atomowo (`UPDATE … WHERE used < free + purchased`) i zwalniany, gdy model zawiedzie.
- Sanitizer własny (regex, bez zależności): zostają `h2/p/ul/ol/li/b` bez atrybutów, `h1/h3→h2`,
  `strong→b`, reszta tagów jest usuwana z zachowaniem tekstu, luźne `<` kodowane. Ten sam algorytm
  w backendzie (`allegro-html.ts`) i frontendzie (`allegroHtml.ts`), z testami lustrzanymi.
- Prompt zabrania zmyślania parametrów, linków i kontaktu; regulamin przerzuca weryfikację faktów na
  użytkownika i wymaga jej jawnie.

## Konsekwencje

- Koszt rozdawania opisów jest pomijalny; ryzykiem jest jakość przy skąpych notatkach (prompt każe
  pisać krócej zamiast dopowiadać).
- Zmiana limitów = `DESCRIPTION_PROMPT_EDITS` / `EDIT_PACK_SIZE` + regulamin + `02-pricing.md`.
