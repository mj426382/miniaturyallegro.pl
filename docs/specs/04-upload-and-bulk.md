# 04 – Przesyłanie zdjęć: pojedyncze, masowe, galeria

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |
| Powiązane | FR-UPL-001, NFR-SEC-003/004, 05 |

## 1. Decyzje

- Formaty JPG/PNG/WebP, max 10 MB, weryfikacja magic bytes i minimalnego rozmiaru 100 px (nie ufamy
  rozszerzeniu ani MIME). Pliki trafiają do B2 (lub na dysk lokalnie), serwowane przez podpisane URL.
- Masowe przesyłanie: do 50 plików, trzy tryby – **tylko prześlij** (0 kredytów, style wybierzesz z
  galerii), **wspólne style** dla partii, **osobne style** dla każdego pliku. Koszt jest pokazany przed
  startem; przy 429 (limit generacji w toku) klient czeka i ponawia.
- Galeria i dashboard pokazują liczbę gotowych grafik i znacznik „Opis ✓”; zdjęcie można usunąć
  (z potwierdzeniem) z galerii i z generatora, ale nie w trakcie generowania.
- Awaria API w galerii/dashboardzie to alert z „Spróbuj ponownie”, nie stan pusty.

## 2. API

`POST /images/upload` (multipart `file`), `GET /images?page&limit` (z `hasDescription`),
`GET /images/:id`, `DELETE /images/:id`, `GET /generation/download/:id` (proxy pliku z nagłówkiem
`Content-Disposition`).

## 3. Kryteria akceptacji

- **AC-UPL-001** – Given poprawny obraz, When przesłany, Then zwraca `id` i `originalUrl`, a lista zdjęć go zawiera.
- **AC-UPL-002** – Given plik z MIME obrazu, ale bez prawdziwej zawartości obrazu, When przesłany, Then 400.
- **AC-UPL-003** – Given żądanie bez pliku, When przesłane, Then 400.
- **AC-UPL-004** – Given zdjęcie innego użytkownika, When odczyt lub usunięcie, Then 403.
- **AC-UPL-005** – Given zdjęcie z grafikami, When usunięte, Then grafiki i pliki znikają razem z nim.
- **AC-UPL-006** – Given gotowa grafika, When pobierana przez endpoint proxy, Then odpowiedź to plik obrazu z nazwą do zapisu.
- **AC-UPL-007** – Given filtr MIME, When plik nie jest obrazem, Then jest odrzucony przed zapisem.
- **AC-UPL-008** – Given plik JPEG, PNG lub WebP, When walidowany po zawartości, Then raportowany jest realny format i rozszerzenie wynika z niego, nie z nazwy pliku.
- **AC-UPL-009** – Given strona przesyłania, When użytkownik doda plik > 10 MB, Then widzi komunikat o rozmiarze; poprawny plik prowadzi do generatora.
- **AC-UPL-010** – Given odrzucony plik (rozmiar, typ, liczba), When dropzone go odrzuci, Then komunikat nazywa przyczynę i plik.
- **AC-UPL-011** – Given tryb „tylko prześlij”, When start, Then pliki są przesłane, żadna generacja nie startuje, koszt 0.
- **AC-UPL-012** – Given tryb wspólnych stylów, When użytkownik zmieni zestaw, Then koszt = pliki × style, a każdy start dostaje ten sam zestaw.
- **AC-UPL-013** – Given tryb osobnych stylów, When użytkownik ustawi różne zestawy, Then każdy plik startuje ze swoim zestawem, a koszt jest sumą.
- **AC-UPL-014** – Given galeria, When zdjęcie ma gotowe grafiki i opis, Then karta pokazuje ich liczbę i „Opis ✓”.
- **AC-UPL-015** – Given galeria, When użytkownik usunie zdjęcie i potwierdzi, Then `DELETE` jest wywołane, a karta znika.
- **AC-UPL-016** – Given dashboard, When załadowany, Then widać liczniki zdjęć i grafik oraz ostatnie zdjęcia.
- **AC-UPL-017** – Given generator, When użytkownik usunie zdjęcie i potwierdzi (anulowanie nic nie robi), Then trafia do galerii, a usuwanie jest zablokowane podczas generowania.
