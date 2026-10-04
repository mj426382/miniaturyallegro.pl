# 15 – Akcje hurtowe: paczka ZIP i opisy dla wielu zdjęć

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-04 |
| Powiązane | FR-BAT-001, FR-BAT-002, 04, 07, 02 |

## 1. Problem i cel

Hurtowe wgrywanie 50 zdjęć kończy się 150 grafikami, które trzeba pobierać pojedynczo, i 50 opisami, które
trzeba otwierać osobno. Cel: jedno kliknięcie pobiera wszystko jako ZIP, drugie pisze opisy dla całej partii.

## 2. Zakres

- W zakresie: zaznaczanie zdjęć w galerii, ZIP z grafikami i opisami, hurtowe pisanie opisów z postępem,
  te same akcje w podsumowaniu masowego przesyłania.
- Poza zakresem (świadomie): hurtowe poprawki opisów promptem, hurtowa publikacja na Allegro.

## 3. Decyzje produktowe

- **ZIP** jest bezpłatny. Zawiera folder na każde zdjęcie (`01-<id>/`, kolejność jak w zaznaczeniu) z
  ukończonymi grafikami (`<nr>-<styl>.<rozszerzenie>`) oraz, gdy jest opis, `opis.html` (gotowy do wklejenia
  w Allegro) i `opis.txt` (tytuł, frazy, tekst). Maks. 50 zdjęć i 300 plików w jednej paczce.
  Plik, którego nie udało się pobrać z magazynu, jest pomijany, a jego nazwa trafia do `BLEDY.txt`.
- **Opisy hurtowo** korzystają z tych samych zasad co pojedynczy opis (07): pierwszy opis każdego zdjęcia
  jest gratis, wymaga ukończonej grafiki. Zdjęcia z opisem są pomijane („ma już opis”). Gdy grafiki zdjęcia
  jeszcze się generują, akcja czeka na pierwszą ukończoną (do 10 min), potem pisze opis. Zdjęcie bez żadnej
  grafiki → „brak gotowej grafiki”.
- Opcjonalne **wspólne informacje** (do 2000 znaków) trafiają do każdego opisu – UI ostrzega, żeby wpisać
  tylko to, co dotyczy wszystkich produktów (marka, gwarancja, wysyłka).
- Kolejka po stronie przeglądarki: 2 opisy równolegle, przy limicie żądań (429) czeka 20 s i ponawia
  (maks. 6 razy), przy chwilowej awarii modelu (503) ponawia raz. Można przerwać – rozpoczęte opisy się
  dokończą, kolejne nie startują.
- Limit endpointu tworzenia opisu podniesiony do 30/min.

## 4. Przepływ użytkownika (UX)

- **Galeria**: przycisk „Zaznacz” włącza tryb wyboru (pole wyboru na każdej karcie, „Zaznacz wszystkie na
  stronie”, licznik). Pasek akcji przyklejony do dołu ekranu: „Pobierz ZIP”, „Napisz opisy”, „Anuluj”.
  ZIP: stan „Przygotowuję paczkę…”, potem pobranie jak w eksporcie.
- **Okno „Opisy dla zaznaczonych”**: liczba zdjęć, pole wspólnych informacji z ostrzeżeniem, „Napisz opisy”,
  lista z postępem (czeka, czeka na grafikę, pisze, gotowe, pominięte, błąd + powód), pasek postępu,
  „Przerwij”, na końcu podsumowanie „Gotowe: X, pominięte: Y, błędy: Z”.
- **Masowe przesyłanie**: po zakończeniu partii w zielonym podsumowaniu przyciski „Pobierz wszystko (ZIP)”
  i „Napisz opisy dla wszystkich” działające na przesłanych zdjęciach.

## 5. Wymagania funkcjonalne

- **FR-BAT-001** – Pobranie grafik i opisów wielu zdjęć jedną paczką ZIP.
- **FR-BAT-002** – Hurtowe pisanie opisów dla wielu zdjęć z postępem.

## 6. Kryteria akceptacji

- **AC-BAT-001** – Given 2 zdjęcia z ukończonymi grafikami (jedno z opisem), When `POST /generation/zip`, Then archiwum ZIP z folderem na każde zdjęcie, grafikami w kolejności i `opis.html`/`opis.txt` tylko przy zdjęciu z opisem; nieukończone grafiki są pominięte.
- **AC-BAT-002** – Given zdjęcie innego użytkownika w liście, When ZIP, Then 404 i nic nie jest wysyłane; lista pusta, > 50 zdjęć albo duplikaty → 400; żadne zdjęcie bez ukończonej grafiki ani opisu → 404.
- **AC-BAT-003** – Given plik grafiki niedostępny w magazynie, When ZIP, Then paczka powstaje z pozostałymi plikami i `BLEDY.txt` z nazwą brakującego.
- **AC-BAT-004** – Given kolejka opisów (zdjęcie z opisem, zdjęcie z gotową grafiką, zdjęcie z grafiką w toku, zdjęcie bez grafik), When przetwarzanie, Then pierwsze pominięte, drugie i trzecie (po ukończeniu grafiki) dostają opis ze wspólnymi informacjami, czwarte kończy się błędem „brak gotowej grafiki”; przy 429 kolejka czeka i ponawia.
- **AC-BAT-005** – Given galeria, When użytkownik włączy zaznaczanie, wybierze zdjęcia i kliknie „Pobierz ZIP”, Then wywołany jest ZIP z wybranymi id i plik jest pobierany; „Napisz opisy” otwiera okno, które pokazuje postęp i podsumowanie.
- **AC-BAT-006** – Given zakończone masowe przesyłanie z generowaniem, When podsumowanie, Then przyciski „Pobierz wszystko (ZIP)” i „Napisz opisy dla wszystkich” działają na przesłanych zdjęciach.

## 7. API

`POST /generation/zip {imageIds: string[]}` (JWT, throttle 5/min) → `application/zip`,
`Content-Disposition: attachment; filename="allgrafika-RRRR-MM-DD.zip"`.
Opisy: istniejące `GET/POST /descriptions/:imageId` (07), `GET /generation/:imageId/results`.

## 8. Dane i migracje

Brak.

## 9. Wymagania niefunkcjonalne

ZIP strumieniowany (pliki pobierane z magazynu kolejno, pamięć stała); nagłówki wysyłane dopiero po
sprawdzeniu własności i walidacji, żeby błędy wracały jako JSON.

## 10. Wpływ na dokumenty

Cennik (02): ZIP bezpłatny; opisy hurtowo na zasadach opisu pojedynczego.

## 12. Plan testów

AC-BAT-001..003 integracyjne (rozpakowanie archiwum w teście); AC-BAT-004 unit (kolejka w przeglądarce,
Vitest z atrapą API); AC-BAT-005..006 przeglądarkowe.
