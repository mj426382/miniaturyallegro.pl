# 06 – Eksport i pobieranie grafik

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |
| Powiązane | FR-EXP-001, NFR-UX-001, 02 (AC-PRC-005), ADR-0003 |

## 1. Decyzje

- Formaty: 1:1 (zdjęcie główne, PNG HQ), 4:3 (galeria), 16:9 (Ads), 3:4 (social). Rozmiar 500–2560 px.
- Formaty inne niż 1:1 domyślnie **kadrują** (interaktywny kadr: przeciąganie, zoom, pinch, strzałki);
  opcja „Cała grafika” dopełnia bielą. Kadr to ułamki 0–1 **obróconego** obrazu, min. 10 % boku.
- Obrót 0/90/180/270°, korekta jasności/kontrastu (0,5–1,5) i nasycenia (0–2), wyostrzenie; podgląd
  CSS odpowiada operacjom sharp.
- Plakietka promocyjna (≤ 24 znaki, 5 kolorów, 4 rogi) z ostrzeżeniem, że Allegro nie dopuszcza
  napisów na zdjęciu głównym.
- Eksport jest bezpłatny i deterministyczny (bez AI). Modal ma dwa kroki: format i kadr → korekta i plakietka.
- Pobieranie: desktop zapisuje plik; iPhone/Android dostają arkusz udostępniania z plikiem; bez wsparcia
  plików – nowa karta lub link; odrzucony arkusz – przycisk „Zapisz w Zdjęciach” do ponownego dotknięcia.

## 2. API

`POST /generation/export/:id { ratio, size, format, crop?, rotate?, adjust?, badgeText?, badgeColor?, badgePosition? }`
→ obraz (`image/jpeg|png|webp`, `Content-Disposition`). Walidacja: proporcje z listy, kadr w obrazie,
obrót z listy, korekty w zakresach, tekst plakietki ≤ 24.

## 3. Kryteria akceptacji

- **AC-EXP-001** – Given grafika, When eksport bez opcji, Then 1:1, JPEG, rozmiar domyślny 1600 px.
- **AC-EXP-002** – Given format 4:3 lub 16:9 bez kadru, When eksport, Then grafika jest dopasowana w całości na białym tle.
- **AC-EXP-003** – Given rozmiar poza zakresem i plakietka, When eksport, Then rozmiar jest przycięty do limitu, a plakietka narysowana w rogu.
- **AC-EXP-004** – Given kadr użytkownika, When eksport, Then wynik zawiera tylko wybrany obszar bez pasów; kadr poza obrazem lub za mały → 400.
- **AC-EXP-005** – Given obrót i korekty, When eksport, Then obrót jest zastosowany przed kadrem, a jasność/kontrast/nasycenie zmieniają piksele zgodnie z wartościami; niepoprawny obrót/korekta → 400.
- **AC-EXP-006** – Given niepoprawne proporcje lub za długa plakietka, When eksport, Then 400.
- **AC-EXP-007** – Given endpoint eksportu, When 4:3 z plakietką, Then plik ma wymiary 800×600 (dla 800 px) i nazwę z proporcjami; nieznane proporcje → 400.
- **AC-EXP-008** – Given endpoint eksportu z kadrem, When 3:4, Then wymiary 600×800; kadr poza obrazem lub niekompletny → 400.
- **AC-EXP-009** – Given desktop, When „Pobierz”, Then plik zapisuje się pod nazwą ze stylem.
- **AC-EXP-010** – Given telefon z Web Share dla plików, When „Pobierz”, Then otwiera się arkusz udostępniania z plikiem obrazu.
- **AC-EXP-011** – Given telefon bez udostępniania plików, When „Pobierz”, Then obraz trafia do pobrania lub nowej karty.
- **AC-EXP-012** – Given modal eksportu, When 4:3, „Cała grafika”, plakietka, Then żądanie zawiera właściwe opcje bez kadru, a plik ma nazwę `…-4x3.jpg`.
- **AC-EXP-013** – Given modal eksportu, When obrót o 90° i korekty, Then żądanie zawiera `rotate` i `adjust`.
- **AC-EXP-014** – Given modal eksportu 3:4, When użytkownik przesunie kadr, Then żądanie zawiera kadr pełnej wysokości i 3/4 szerokości wewnątrz obrazu.
- **AC-EXP-015** – Given iPhone z `canShare`, When pobieranie, Then użyty jest arkusz udostępniania.
- **AC-EXP-016** – Given anulowany arkusz, When pobieranie, Then brak dodatkowego okna.
- **AC-EXP-017** – Given iOS bez udostępniania plików, When pobieranie, Then nowa karta.
- **AC-EXP-018** – Given zablokowane okno na iOS, When pobieranie, Then link `download` jako awaryjne wyjście.
- **AC-EXP-019** – Given wygasła aktywacja użytkownika, When udostępnianie odrzucone, Then UI wie, że trzeba ponownego dotknięcia, a `shareBlob` wtedy działa.
- **AC-EXP-020** – Given procenty kadru z edytora, When konwersja, Then ułamki zaokrąglone do 4 miejsc.
- **AC-EXP-021** – Given kadr wykraczający poza obraz, When konwersja, Then jest przycięty do granic obrazu.
