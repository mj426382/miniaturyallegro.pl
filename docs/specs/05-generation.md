# 05 – Generowanie grafik

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-04 |
| Powiązane | FR-GEN-001, FR-ADM-001, 02, NFR-PERF-003..005, NFR-REL-001, ADR-0002 |

## 1. Decyzje

- 19 stylów w trzech kategoriach: **uniwersalne** (6, w tym 3 `starter`: białe tło, lifestyle, ciemny
  luksus – domyślny zestaw), **sezonowe** (5: Boże Narodzenie, Black Friday, Walentynki, Wielkanoc, Lato)
  i **branżowe** (8: moda, elektronika, kosmetyki, dom i ogród, dziecięce, sport, motoryzacja, żywność).
  Styl sezonowy ma okno dat (`MM-DD`–`MM-DD`, także przez Nowy Rok); w swoim sezonie API zwraca
  `inSeason=true`, a UI pokazuje go na początku grupy z etykietą „Teraz”. Wszystkie style są dostępne
  cały rok. Grupa sezonowa ma podpowiedź: „Na zdjęcia dodatkowe i kampanie – zdjęcie główne zostaw
  na białym tle”. Style sezonowe i branżowe nie dodają tekstu ani cyfr (zasady Allegro i jakość modelu).
  Masowe przesyłanie pokazuje te same grupy. Użytkownik wybiera
  dowolny podzbiór; po zakończeniu partii zaznaczone są jeszcze niewygenerowane style uniwersalne (sezonowe i
  branżowe wybiera się świadomie, żeby domyślna partia nie była droga), a panel wyboru
  zwija się, żeby wyniki były na wierzchu.
- Pipeline: opis produktu z OpenAI (raz na zdjęcie, cache), prompty stylów w jednym wywołaniu JSON,
  obraz z Gemini 2.5 Flash Image z angielskimi regułami integralności produktu; współbieżność ograniczona
  semaforem; retry z backoff, bez retry przy błędach limitu.
- Kredyty: pobierane w transakcji z blokadą wiersza razem z utworzeniem wierszy generacji; max 30 w toku;
  nieudane zwracane; reconciler co 5 min oznacza generacje > 20 min jako nieudane i zwraca kredyty.
- Własny styl: prompt po polsku (3–500 znaków), opcjonalne zdjęcie referencyjne; przeróbka = baza to
  wcześniejsza grafika. Ponowienie nieudanej generacji jest bezpłatne (kredyt już zwrócony → pobierany ponownie).
- Ocena: kciuk góra/dół z powodem; agregaty per styl dla operatora (`/admin/feedback-stats`).
- Statusy odświeżają się w UI co 4 s bez przeładowania, limit 15 min, potem komunikat.

## 2. API

`GET /generation/styles`, `POST /generation/:imageId/start {styles?, basePrompt?}`,
`POST /generation/:imageId/custom (multipart prompt, reference?, rework?)`, `POST /generation/retry/:id`,
`POST /generation/feedback/:id`, `GET /generation/:imageId/results`, `GET /generation/result/:id`.
Admin: `GET /admin/overview|feedback-stats|withdrawal-quote`.

## 3. Kryteria akceptacji

- **AC-GEN-001** – Given katalog stylów, When pobrany, Then zawiera 19 stylów (6 uniwersalnych, 5 sezonowych, 8 branżowych) z unikalnymi id, kategorią i 3 identyfikatory startowe.
- **AC-GEN-002** – Given zdjęcie, When start bez listy stylów, Then powstają 3 generacje startowe i pobierane są 3 kredyty.
- **AC-GEN-003** – Given zdjęcie z opisem w cache, When start kolejnych stylów, Then opis nie jest tworzony ponownie, a nowe generacje kończą się sukcesem.
- **AC-GEN-004** – Given równoległe starty, When suma generacji w toku przekroczyłaby 30, Then nadmiarowe dostają 429, a kredyty nie są pobierane.
- **AC-GEN-005** – Given nieznany styl lub za długa wskazówka, When start, Then 400.
- **AC-GEN-006** – Given za mało kredytów, When start, Then 402 i brak generacji.
- **AC-GEN-007** – Given awaria analizy zdjęcia, When partia startuje, Then wszystkie generacje są nieudane, a kredyty zwrócone.
- **AC-GEN-008** – Given prompt i opcjonalna referencja, When własny styl, Then powstaje jedna generacja i kończy się sukcesem.
- **AC-GEN-009** – Given za krótki prompt lub niepoprawna referencja, When własny styl, Then 400 bez pobrania kredytu.
- **AC-GEN-010** – Given gotowa grafika, When ocena z powodem, Then jest zapisana i widoczna w agregacie per styl.
- **AC-GEN-011** – Given generacje zawieszone > 20 min, When reconciler działa, Then są nieudane, a kredyty zwrócone.
- **AC-GEN-012** – Given identyfikator stylu, When wyszukany, Then zwraca definicję lub `undefined`.
- **AC-GEN-013** – Given zmienna środowiskowa z listą stylów startowych, When zawiera nieznane id, Then są ignorowane.
- **AC-GEN-014** – Given wywołanie Gemini, When budowane, Then zawiera oryginalne zdjęcie, prompt z regułami i podpowiedź proporcji 1:1.
- **AC-GEN-015** – Given API odrzuca `imageConfig`, When pierwsza próba, Then ponawia bez niego i zapamiętuje.
- **AC-GEN-016** – Given model nie zwraca obrazu (np. blokada), When generacja, Then błąd ma czytelny opis.
- **AC-GEN-017** – Given prompt stylu, When budowany, Then zawiera angielskie reguły integralności produktu i wymagania Allegro.
- **AC-GEN-018** – Given błąd 503, When wywołanie, Then retry; przy błędzie limitu – brak retry.
- **AC-GEN-019** – Given semafor współbieżności, When zadanie rzuci wyjątek, Then slot jest zwalniany.
- **AC-GEN-020** – (opt-in, prawdziwe API) Given klucze, When pełny pipeline, Then powstaje dekodowalny kwadratowy obraz.
- **AC-GEN-021** – Given generator w UI, When użytkownik użyje własnego stylu, ponowi nieudaną grafikę i oceni gotową, Then wywołane są właściwe endpointy, a usuwanie zdjęcia jest zablokowane w trakcie generowania.
- **AC-GEN-022** – Given okno sezonu (również przechodzące przez Nowy Rok), When data w oknie lub poza nim, Then `inSeason` jest odpowiednio `true`/`false`; style niesezonowe nigdy nie są „w sezonie”.
- **AC-GEN-023** – Given każdy styl sezonowy i branżowy, When prompt jest budowany, Then jest po angielsku, zakazuje tekstu, cyfr i logo oraz zawiera reguły integralności produktu.
- **AC-GEN-024** – Given generator i masowe przesyłanie, When lista stylów, Then style są pogrupowane (Uniwersalne, Sezonowe, Branżowe), styl w sezonie jest pierwszy w grupie z etykietą „Teraz”, a zaznaczenie stylu sezonowego wlicza się do kosztu; po partii domyślnie zaznaczone są tylko brakujące style uniwersalne.
- **AC-ADM-001** – Given endpointy admina, When wywołane przez konto spoza `ADMIN_EMAILS`, Then 403; dla admina zwracają przegląd operacyjny.
