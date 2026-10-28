# 27 – Moje style (zapisane style użytkownika)

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-28 |
| Powiązane | spec 05 (generowanie, własny styl AC-GEN-008/028/031/033/034), spec 04 (masowe przesyłanie), spec 02 (cennik), spec 03 (usuwanie konta) |

## 1. Problem i cel

Sprzedawca, który ma swój wygląd ofert (np. „produkt na drewnianym stole z psem w tle”), musi dziś przy każdym
zdjęciu wpisywać ten sam opis i dołączać to samo zdjęcie wzoru w zakładce „Własny styl”, a w masowym przesyłaniu
własnego stylu w ogóle nie ma. Cel: styl zapisuje się raz w zakładce „Moje style” i potem wybiera jak styl
wbudowany – w generatorze i przy masowym przesyłaniu.
Miara sukcesu: liczba grafik z zapisanych stylów i liczba kont z co najmniej jednym stylem (panel, generacje
z `styleLabel`).

## 2. Zakres

- W zakresie: zakładka „Moje style” (lista, dodawanie, edycja, usuwanie), grupa „Moje style” w generatorze
  i w masowym przesyłaniu (oba tryby: wspólne style i style per zdjęcie), generowanie grafiki z zapisanego stylu,
  usuwanie stylów z kontem.
- Poza zakresem (świadomie): udostępnianie stylów innym kontom, zapisywanie stylu z gotowej grafiki, kilka zdjęć
  wzoru w jednym stylu, przeróbka (tryb przeróbki zostaje w zakładce „Własny styl”).

## 3. Decyzje produktowe

1. **Styl** = nazwa (2–60 znaków, unikalna w koncie bez względu na wielkość liter), opis sceny po polsku
   (3–500 znaków – ten sam limit co „Własny styl”) i opcjonalnie jedno zdjęcie wzoru (JPG/PNG/WebP do 10 MB,
   walidowane i kompresowane jak zdjęcie referencyjne własnego stylu).
2. **Limit**: 20 stylów na konto – wystarczy na katalog sklepu, a chroni magazyn plików.
3. **Cena**: zapisanie stylu jest bezpłatne. Grafika z zapisanego stylu kosztuje **1 kredyt**, jak każda grafika
   (spec 02); nieudana – kredyt wraca do puli, z której go pobrano (AC-GEN-027).
4. **Generowanie**: grafika z zapisanego stylu to generacja „własny styl” (`style = 'custom'`) z opisem i wzorem
   stylu w chwili startu. Zdjęcie wzoru jest **kopiowane** do pliku tej generacji, bo po udanej grafice plik
   referencji generacji jest usuwany (AC-GEN-028) – plik stylu zostaje nietknięty. Ponowienie nieudanej grafiki
   używa tej kopii. Generacja zapisuje nazwę stylu (`styleLabel`) do podpisu karty wyniku.
5. **Edycja lub usunięcie stylu** nie zmienia gotowych ani trwających grafik (mają własną kopię opisu i wzoru).
   Usunięcie stylu usuwa jego plik wzoru; usunięcie konta usuwa wszystkie style i ich pliki (spec 03).
6. **Generator**: grupa „Moje style” na górze listy stylów, przed „Uniwersalne”; zaznaczone style wliczają się do
   kosztu tak samo jak wbudowane. Ten sam zapisany styl można uruchomić ponownie (jak „Własny styl”).
7. **Masowe przesyłanie**: style użytkownika są do wyboru w obu trybach; dla każdego zdjęcia uruchamiana jest
   jedna generacja na każdy wybrany zapisany styl (po stylach wbudowanych tego zdjęcia).

## 4. Przepływ użytkownika (UX)

- Menu aplikacji: pozycja **„Moje style”** (`/styles`) po „Masowe przesyłanie”.
- Pusty stan: „Nie masz jeszcze zapisanych stylów. Opisz scenę raz – potem wybierzesz ją przy każdym zdjęciu.”
  i przycisk „Dodaj styl”.
- Formularz: „Nazwa stylu”, „Opis sceny” (pole wielowierszowe, licznik 500 znaków, podpowiedź: „Opisz tło,
  otoczenie i klimat, np. produkt na drewnianym stole w jasnej kuchni, obok siedzi kot. Produkt i jego napisy
  zostaną bez zmian.”), „Zdjęcie wzoru (opcjonalnie)” z podglądem i „Usuń zdjęcie”. Przyciski „Zapisz styl” /
  „Anuluj”. Błędy walidacji przy polach; duplikat nazwy: „Masz już styl o tej nazwie.”; limit: „Możesz mieć
  najwyżej 20 stylów – usuń któryś, aby dodać nowy.”
- Lista: karta z nazwą, opisem (skrót), miniaturą wzoru, przyciski „Edytuj” i „Usuń” (potwierdzenie
  „Usunąć styl „X”? Gotowe grafiki zostaną.”).
- Generator i masowe przesyłanie: grupa „Moje style” z linkiem „Zarządzaj stylami”; gdy brak stylów –
  „Zapisz własny styl, aby wybierać go jednym kliknięciem” z linkiem do `/styles`.
- Karta wyniku grafiki z zapisanego stylu: podpis „Mój styl: <nazwa>”.

## 5. Wymagania funkcjonalne

- **FR-UST-001** – Użytkownik zarządza do 20 zapisanymi stylami (nazwa, opis, opcjonalny wzór).
- **FR-UST-002** – Zapisany styl można wybrać w generatorze i w masowym przesyłaniu; grafika kosztuje 1 kredyt.

## 6. Kryteria akceptacji

- **AC-UST-001** – Given zalogowany użytkownik, When doda styl z nazwą, opisem i zdjęciem wzoru, a potem pobierze listę, Then styl jest na liście z `referenceUrl`, nazwa i opis są przycięte, plik wzoru jest skompresowany w magazynie, a styl bez zdjęcia ma `referenceUrl = null`; lista jest posortowana od najnowszych i nie zawiera stylów innych kont.
- **AC-UST-002** – Given dane stylu, When nazwa krótsza niż 2 lub dłuższa niż 60 znaków, opis krótszy niż 3 lub dłuższy niż 500 znaków albo plik nie jest obrazem (JPG/PNG/WebP), Then 400 i nic nie jest zapisywane (ani wiersz, ani plik).
- **AC-UST-003** – Given konto ze stylem „Kuchnia”, When doda styl „kuchnia” albo zmieni nazwę innego stylu na „KUCHNIA”, Then 409 „Masz już styl o tej nazwie.”; Given 20 stylów, When doda kolejny, Then 409 z komunikatem o limicie, a plik wzoru nie zostaje w magazynie.
- **AC-UST-004** – Given styl ze wzorem, When edycja zmienia nazwę i opis, wymienia zdjęcie albo je usuwa (`removeReference`), Then zmiany są zapisane, stary plik wzoru jest usuwany z magazynu; styl cudzego konta albo nieistniejący → 404 przy edycji, usuwaniu i generowaniu.
- **AC-UST-005** – Given styl ze wzorem, When go usunę, Then znika z listy, jego plik jest usunięty, a gotowe grafiki z tego stylu zostają; When usunę konto, Then wszystkie style i ich pliki są usunięte.
- **AC-UST-006** – Given zdjęcie i zapisany styl ze wzorem, When `POST /generation/:imageId/user-style/:styleId`, Then powstaje jedna generacja `custom` z opisem stylu, `styleLabel` = nazwa stylu, kopią wzoru (inny klucz niż plik stylu), kosztem 1 kredytu; po udanej grafice kopia jest usuwana, a plik stylu zostaje; za mało kredytów → 402 bez generacji i bez kopii.
- **AC-UST-007** – Given grafika z zapisanego stylu nie udała się, When styl zostanie zmieniony albo usunięty, a użytkownik ponowi grafikę, Then ponowienie używa opisu i kopii wzoru z chwili startu, a kredyt wraca do właściwej puli przy błędzie.
- **AC-UST-008** – Given zakładka „Moje style” w aplikacji, When użytkownik doda, edytuje i usunie styl (pusty stan, licznik znaków, błędy walidacji, duplikat nazwy, potwierdzenie usunięcia), Then wywołane są właściwe endpointy, a lista się odświeża; pozycja „Moje style” jest w menu.
- **AC-UST-009** – Given generator z zapisanymi stylami, When użytkownik zaznaczy 1 styl wbudowany i 2 zapisane, Then grupa „Moje style” jest pierwsza, koszt pokazuje 3 kredyty, start wywołuje `/start` dla stylu wbudowanego i `/user-style/:styleId` dla każdego zapisanego, a karta wyniku ma podpis „Mój styl: <nazwa>”; bez stylów grupa pokazuje link do `/styles`.
- **AC-UST-010** – Given masowe przesyłanie z zapisanym stylem wybranym wspólnie i innym tylko dla jednego zdjęcia, When start, Then dla każdego zdjęcia uruchamiane są style wbudowane, a potem po jednej generacji na każdy wybrany zapisany styl tego zdjęcia; koszt partii je uwzględnia.

## 7. API

- `GET /user-styles` → `[{ id, name, prompt, referenceUrl, createdAt, updatedAt }]` (`referenceUrl` – adres
  podpisany jak wyniki grafik, albo `null`).
- `POST /user-styles` (multipart: `name`, `prompt`, `reference?`) → 201 styl; 400 walidacja; 409 duplikat / limit.
- `PATCH /user-styles/:id` (multipart: `name?`, `prompt?`, `reference?`, `removeReference?`) → 200 styl; 404; 409.
- `DELETE /user-styles/:id` → 200 `{ ok: true }`; 404.
- `POST /generation/:imageId/user-style/:styleId` → 201 `{ generationId }`; 402 brak kredytów; 404 styl/zdjęcie;
  429 limit generacji w toku (AC-GEN-004).
- Wszystkie wymagają zalogowania; zapis stylów i generowanie: limit 10–20 żądań/min jak własny styl.

## 8. Dane i migracje

- Nowa tabela `user_styles` (`id`, `userId` → users ON DELETE CASCADE, `name`, `prompt`, `referenceKey?`,
  `createdAt`, `updatedAt`, indeks `userId, createdAt`).
- Nowa kolumna `generations.styleLabel TEXT NULL` – istniejące wiersze bez zmian (`null`).

## 9. Wymagania niefunkcjonalne

- Pliki wzorów w folderze `user-styles`, kompresowane jak referencje (koszt magazynu, NFR-SEC-011: adresy podpisane).
- Brak nowych kosztów AI poza samą grafiką (opis sceny przechodzi przez optymalizator promptu jak „Własny styl”).
- RODO: style to dane konta użytkownika, usuwane z kontem; polityka prywatności – bez zmian (pliki przesłane
  przez użytkownika są już opisane).

## 10. Wpływ na dokumenty

Regulamin i polityka: bez zmian (grafika = 1 kredyt, pliki użytkownika już opisane). README aplikacji: nowa zakładka.

## 11. Ryzyka i pytania otwarte

- Masowe przesyłanie z wieloma zapisanymi stylami szybko zużywa kredyty – koszt partii jest pokazany przed startem.

## 12. Plan testów

AC-UST-001..007 – testy integracyjne backendu (`backend/test/user-styles.e2e-spec.ts`); AC-UST-008..010 – testy
przeglądarkowe aplikacji z atrapą API (`frontend/e2e/user-styles.spec.ts`).
