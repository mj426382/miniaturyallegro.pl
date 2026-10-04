# 14 – Infografiki (zdjęcia dodatkowe z cechami i wymiarami)

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-04 |
| Powiązane | FR-INF-001, 05, 06, 02 |

## 1. Problem i cel

Duzi sprzedawcy na Allegro mają w galerii oferty zdjęcia z cechami produktu, ikonami i wymiarami. Allegro
zabrania tekstu na zdjęciu głównym, ale na kolejnych to standard, który podnosi konwersję. Mały sprzedawca
nie ma grafika. Cel: z gotowej grafiki AllGrafiki zrobić w minutę czytelną infografikę z poprawnym polskim
tekstem.

## 2. Zakres

- W zakresie: dwa szablony (cechy z ikonami, wymiary), motyw jasny/ciemny, kolor akcentu, tytuł,
  podgląd i pobranie PNG/JPG 1600×1600 px.
- Poza zakresem (świadomie): generowanie infografik przez model AI (modele psują polski tekst i liczby),
  dowolny edytor warstw, zapisywanie infografik w galerii i publikacja na Allegro jednym kliknięciem.

## 3. Decyzje produktowe

- Render deterministyczny na serwerze (sharp + SVG, font DejaVu Sans z pełnymi polskimi znakami) – bez
  kosztu AI, więc **za darmo** jak eksport.
- Źródło: ukończona grafika użytkownika (dowolny styl; najlepiej „Białe tło”).
- Szablon **Cechy**: produkt po lewej, po prawej 1–6 cech, każda z ikoną w kółku w kolorze akcentu
  i tekstem do 48 znaków (zawijany do 2 linii). Opcjonalny tytuł do 40 znaków u góry.
- Szablon **Wymiary**: produkt na środku, strzałki z opisem szerokości (pod produktem) i wysokości
  (po prawej); głębokość i waga jako etykiety w dolnym pasku. Wymagana co najmniej szerokość albo
  wysokość. Jednostki: mm, cm, m; waga: g, kg. Liczby formatowane po polsku (przecinek dziesiętny).
  Przy białym tle produkt jest przycinany do swojego obrysu, żeby strzałki przylegały do produktu.
- 20 ikon wbudowanych (np. gwarancja, dostawa, wodoodporność, bateria, eko, rozmiar, waga, czas, moc,
  prezent, recykling, temperatura, łączność bezprzewodowa, ergonomia, jakość, zestaw, bezpieczeństwo).
- Gdy zdjęcie ma opis oferty, lista cech jest wstępnie wypełniona punktami z sekcji „Najważniejsze cechy”
  (maks. 5, przycięte do 48 znaków) – użytkownik je poprawia.
- Komunikat w oknie: „Allegro nie pozwala na tekst na zdjęciu głównym – dodaj infografikę jako kolejne
  zdjęcie oferty.”

## 4. Przepływ użytkownika (UX)

Karta grafiki → menu „Więcej akcji” → „Infografika”. Okno (wzorzec modala z `11-ui-design-system.md`):
wybór szablonu, tytuł, lista cech (ikona z listy + tekst, „Dodaj cechę”, usuń) albo pola wymiarów,
motyw i akcent, przycisk „Podgląd” (stan ładowania), obraz podglądu, przycisk „Pobierz PNG”. Błędy
walidacji z serwera pokazywane w alercie w oknie. Na telefonie okno na pełną szerokość, pobieranie
tą samą ścieżką co eksport (06).

## 5. Wymagania funkcjonalne

- **FR-INF-001** – Darmowe infografiki z cechami i wymiarami z ukończonej grafiki.

## 6. Kryteria akceptacji

- **AC-INF-001** – Given ukończona grafika i szablon cech z 1–6 cechami, When render, Then obraz PNG 1600×1600, kredyty bez zmian.
- **AC-INF-002** – Given szablon wymiarów z szerokością i wysokością (oraz opcjonalnie głębokością i wagą), When render, Then obraz 1600×1600; bez szerokości i wysokości → 400.
- **AC-INF-003** – Given tekst z `<`, `&`, `"` i polskimi znakami, When budowa SVG, Then znaki są zakodowane jako encje XML, nie ma wstrzyknięcia elementów SVG, a polskie litery zostają.
- **AC-INF-004** – Given długie cechy, When układ, Then tekst zawija się do maksymalnie 2 linii z wielokropkiem; wartości liczbowe wymiarów formatowane z przecinkiem i jednostką.
- **AC-INF-005** – Given nieprawidłowe dane (0 albo 7 cech, nieznana ikona, tekst > 48 znaków, wymiar ≤ 0, nieznana jednostka), When żądanie, Then 400 z polskim komunikatem.
- **AC-INF-006** – Given grafika innego użytkownika, nieistniejąca albo nieukończona, When żądanie, Then odpowiednio 403, 404 albo 400 (jak w eksporcie).
- **AC-INF-007** – Given biała grafika z produktem na środku, When szablon wymiarów, Then produkt jest przycięty do obrysu (strzałki przy produkcie); dla grafiki bez jednolitego tła używany jest cały kadr.
- **AC-INF-008** – Given okno infografiki, When użytkownik wybierze szablon, wpisze cechy, kliknie „Podgląd” i „Pobierz”, Then widzi podgląd i pobiera plik; zdjęcie z opisem ma wstępnie wypełnione cechy z „Najważniejszych cech”.

## 7. API

`POST /generation/infographic/:generationId` (JWT, throttle 30/min) body:
`{ template: 'features'|'dimensions', title?, features?: [{icon, text}], dimensions?: {width?, height?, depth?, unit, weight?, weightUnit?}, theme?: 'light'|'dark', accent?: 'red'|'orange'|'green'|'blue'|'black', format?: 'png'|'jpeg' }`
→ obraz (`Content-Disposition: attachment`). `GET /generation/infographic-icons` → lista ikon (id, nazwa).

## 8. Dane i migracje

Brak – infografika nie jest zapisywana.

## 9. Wymagania niefunkcjonalne

Render < 1 s dla grafiki 1600 px; wejście użytkownika zawsze kodowane w SVG; brak wywołań AI.

## 10. Wpływ na dokumenty

Cennik (02): infografiki bezpłatne. Landing: wzmianka w funkcjach.

## 12. Plan testów

AC-INF-001..007 unit (serwis renderujący) i integracyjne (endpoint, własność, walidacja);
AC-INF-008 przeglądarkowe.
