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
- **Usuwanie metadanych** (decyzja właściciela 2026-10-17): każdy zapisany oryginał – przesłany
  pojedynczo, masowo i w demo na landingu – jest przed zapisem obracany zgodnie z orientacją EXIF
  i kodowany ponownie w tym samym formacie bez EXIF (w tym GPS i dane aparatu), XMP i IPTC. Profil
  kolorów ICC zostaje, jeśli był. JPEG: jakość 95. Pliki zapisane wcześniej czyści jednorazowy skrypt
  `backend/scripts/strip-exif-existing.ts` (domyślnie próba na sucho, partie, wznawianie od ostatniego
  id; w logach tylko identyfikatory i liczby). Uruchomienie skryptu na produkcji to decyzja właściciela.
- **Limity przesyłania** (decyzja właściciela 2026-10-17; zmienne środowiskowe walidowane przy starcie):
  - Konto niepotwierdzone: łącznie `UPLOAD_LIMIT_UNVERIFIED` zdjęć (domyślnie 5, liczba całkowita
    0–1000). Usunięcie zdjęcia nie zwalnia miejsca w limicie. Odpowiedź po przekroczeniu: 403
    z kodem `UPLOAD_LIMIT_UNVERIFIED`.
  - Konto potwierdzone: `UPLOAD_LIMIT_PER_DAY` zdjęć w ruchomym oknie 24 h (domyślnie 200, liczba
    całkowita 1–10000). Odpowiedź: 429 z kodem `UPLOAD_LIMIT_DAILY`, polem `retryAfterSeconds`
    i nagłówkiem `Retry-After`.
  - Przy `EMAIL_VERIFICATION_REQUIRED=false` (awaria poczty, spec 13) konto niepotwierdzone ma limit
    dzienny konta potwierdzonego.
  - Limit jest liczony atomowo: każde przesłanie rezerwuje miejsce pod blokadą wiersza konta w
    rejestrze `upload_log`, więc równoległe żądania (masowe przesyłanie) nie przekroczą limitu. Plik
    odrzucony przez walidację nie zużywa miejsca, a błąd zapisu w magazynie je zwalnia.
  - Masowe przesyłanie to osobne żądania na plik, więc wynik jest per plik: część plików przechodzi,
    pozostałe dostają kod limitu. Wpisy rejestru starsze niż 48 h kont potwierdzonych są usuwane
    przez zadanie sprzątania co 24 h.

## 2. API

`POST /images/upload` (multipart `file`), `GET /images?page&limit` (z `hasDescription`),
`GET /images/:id`, `DELETE /images/:id`, `GET /generation/download/:id` (proxy pliku z nagłówkiem
`Content-Disposition`).

Błędy limitu (treść JSON, aplikacja pokazuje `message`, a po `code` może dobrać akcję):

- 403 `{code: "UPLOAD_LIMIT_UNVERIFIED", limit, message: "Przed potwierdzeniem adresu e-mail możesz przesłać
  najwyżej 5 zdjęć. Kliknij link z wiadomości, którą wysłaliśmy po rejestracji (możesz wysłać go ponownie
  z banera u góry strony), a potem prześlesz kolejne."}`
- 429 `{code: "UPLOAD_LIMIT_DAILY", limit, retryAfterSeconds, message: "Osiągnięto dzienny limit 200
  przesłanych zdjęć. Kolejne prześlesz za około N godz."}` + nagłówek `Retry-After`.

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
- **AC-UPL-018** – Given `B2_ENDPOINT` podany jako sam host (bez `https://`), When backend startuje, Then endpoint jest uzupełniany o schemat i podpisywanie URL działa (AWS SDK v3 odrzuca adres bez schematu; wartość pusta oznacza dysk lokalny).
- **AC-UPL-019** – Given zdjęcie JPEG z EXIF (GPS, aparat, autor), XMP, IPTC, profilem ICC i orientacją 6 oraz zdjęcia PNG i WebP z EXIF/XMP, When przesłane pojedynczo albo przez demo na landingu, Then zapisany plik nie ma EXIF, GPS, XMP ani IPTC, ma ten sam format, obraz jest obrócony zgodnie z orientacją (wymiary i rozmieszczenie pikseli), a profil ICC zostaje.
- **AC-UPL-020** – Given konto niepotwierdzone, When przesyła zdjęcia, Then 5 przechodzi, a 6. dostaje 403 `UPLOAD_LIMIT_UNVERIFIED` z komunikatem po polsku; usunięcie zdjęcia nie zwalnia limitu; po potwierdzeniu adresu przesyłanie działa; przy `EMAIL_VERIFICATION_REQUIRED=false` obowiązuje limit dzienny.
- **AC-UPL-021** – Given konto potwierdzone z limitem dziennym, When limit w ostatnich 24 h jest wykorzystany, Then kolejne przesłanie dostaje 429 `UPLOAD_LIMIT_DAILY` z `retryAfterSeconds` i nagłówkiem `Retry-After`; przesłania sprzed ponad 24 h się nie liczą (granica okna), a plik odrzucony przez walidację nie zużywa limitu.
- **AC-UPL-022** – Given 20 równoległych przesłań na granicy limitu (konto potwierdzone i niepotwierdzone, także masowe przesyłanie częściowo ponad limit), When obsłużone, Then przechodzi dokładnie tyle, ile zostało w limicie, każdy pozostały plik dostaje własną odpowiedź z kodem limitu, a liczba zdjęć w bazie i plików w magazynie równa się liczbie sukcesów.
- **AC-UPL-023** – Given limity uploadu w konfiguracji, When `UPLOAD_LIMIT_UNVERIFIED` lub `UPLOAD_LIMIT_PER_DAY` nie są liczbami całkowitymi w dozwolonym zakresie, Then start jest odrzucony; brak zmiennych oznacza wartości domyślne 5 i 200.
- **AC-UPL-025** – Given data przed `UPLOAD_LIMITS_FROM`, When konto niepotwierdzone lub potwierdzone przesyła zdjęcia ponad limit, Then przesłania przechodzą i są zapisywane w rejestrze; od tej daty te same konta dostają 403/429 zgodnie z AC-UPL-020/021, licząc także przesłania sprzed tej daty z okna; niepoprawna data w `UPLOAD_LIMITS_FROM` blokuje start aplikacji.
- **AC-UPL-024** – Given zapisane wcześniej oryginały z metadanymi, When działa skrypt czyszczący, Then w trybie domyślnym (próba na sucho) nic nie zmienia i raportuje liczby, z `--apply` nadpisuje tylko pliki z metadanymi (orientacja zastosowana, ICC zachowany), przetwarza partiami, wznawia od podanego id, pomija pliki nieczytelne i w logach podaje tylko identyfikatory i liczby.

## 4. Dane i migracje

Migracja `20261018100000_tombstones_upload_quota` (addytywna): tabela `upload_log (id, userId FK cascade,
createdAt, indeks (userId, createdAt))` – rejestr przesłań do liczenia limitów. Migracja przenosi do rejestru
istniejące zdjęcia kont niepotwierdzonych (wszystkie) i zdjęcia przesłane w ostatnich 24 h (wszystkie
konta), więc rejestr jest kompletny od wdrożenia. Limity są egzekwowane od `UPLOAD_LIMITS_FROM` (domyślnie
2026-11-01T00:00:00+01:00 – regulamin § 5 ust. 4 i § 11: zmiana ograniczająca Użytkowników wchodzi w życie
14 dni po publikacji, § 2 ust. 4); wcześniej przesłania są tylko zapisywane w rejestrze.
