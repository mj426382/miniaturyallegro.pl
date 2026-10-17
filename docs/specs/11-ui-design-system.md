# 11 – Język UI i wzorce UX

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 (zmiany 2026-10-18: wspólny modal z pułapką fokusu, „E-mail”, komunikaty limitów przesyłania) |
| Powiązane | NFR-A11Y-*, NFR-UX-*, `frontend/src/index.css`, `frontend/e2e/a11y.spec.ts`, `frontend/e2e/modals.spec.ts`, spec 04, spec 17 |

## 1. Zasady

1. **Jeden sposób na jedną rzecz.** Przycisk główny, drugorzędny, niebezpieczny, alert, pole – zawsze
   z klas współdzielonych (`btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost`, `alert-error`,
   `alert-info`, `alert-success`, `input-field`, `card`, `help-text`). Zakaz ad-hoc kombinacji Tailwind
   dla tych elementów.
2. **Błędy formularza są przy formularzu**, nie w toaście: komponent `FormAlert` (`role="alert"`).
   Toasty służą do potwierdzeń akcji („Zapisano”, „Opis gotowy”) i informacji nieblokujących.
3. **Każda akcja nieodwracalna wymaga potwierdzenia** w `ConfirmProvider` (`role="alertdialog"`,
   Escape anuluje, fokus na przycisku potwierdzenia, przycisk czerwony `btn-danger`).
4. **Stany są jawne**: pusty (ramka przerywana + CTA), ładowanie (szkielet lub spinner), błąd
   (`role="alert"` + „Spróbuj ponownie”), sukces. Awaria API nigdy nie wygląda jak „brak danych”.
5. **Jedna akcja główna na kartę**, reszta w menu „Więcej akcji” (`ActionMenu`, `role="menu"`).
6. **Telefon pierwszy**: układ działa od 360 px, toasty na dole ekranu, cele dotykowe ≥ 40 px,
   gesty (przeciąganie, pinch) mają alternatywę (suwak, przyciski).
7. **Kolor nie jest jedynym nośnikiem informacji** (status ma tekst, ikona ma etykietę).

## 2. Tokeny

| Rola | Wartość |
|---|---|
| Akcent / interakcja | `blue-600` (hover `blue-700`), tło zaznaczenia `blue-50` |
| Sukces / błąd / ostrzeżenie | `green-700` / `red-600` / `amber-700` na jasnych tłach `*-50` |
| Tekst | podstawowy `gray-900`, drugorzędny `gray-600`, pomocniczy `gray-500` (min. kontrast AA 4.5:1); `gray-400` tylko dla elementów dekoracyjnych i placeholderów |
| Tło | aplikacja `gray-50`, karty `white`, obramowania `gray-200` |
| Promień | `rounded-lg` kontrolki, `rounded-xl` karty, `rounded-2xl` modale |
| Typografia | Inter (landing) / systemowa (aplikacja); nagłówek strony `text-2xl font-bold`, sekcji `text-lg font-semibold` |

## 3. Komponenty (frontend/src/components)

| Komponent | Kiedy |
|---|---|
| `AuthLayout` | Każdy ekran bez sesji: logo, h1, podtytuł, karta |
| `PasswordInput` | Każde pole hasła (toggle widoczności z etykietą, pomoc o stałej wysokości) |
| `FormAlert` | Błąd/informacja/sukces przy formularzu |
| `Modal` + `useModalDialog` | Każde okno modalne: portal do `<body>`, rola dialogu z nazwą, pułapka fokusu, Escape, tło `inert`, powrót fokusu |
| `ModalFallback` | Nakładka „Ładowanie…” na czas doczytania leniwego chunku okna |
| `ConfirmDialog` + `useConfirm` | Potwierdzenia akcji destrukcyjnych |
| `UploadLimitAlert` | Komunikat limitu przesyłania (pojedynczo i masowo) z następnym krokiem |
| `ActionMenu` | Menu „…” dla akcji drugorzędnych |
| `ErrorBoundary` | Globalny ekran awaryjny |
| `ImageCard` | Karta zdjęcia w galerii/dashboardzie (liczba grafik, „Opis ✓”, usuń) |
| `ExportModal` + `CropEditor` | Eksport w dwóch krokach: format i kadr → korekta i plakietka |
| `OfferDescriptionPanel` | Opis oferty: notatki, podgląd/HTML, frazy, poprawki, pakiety |
| `AppToaster` | Toasty: góra-prawo na desktopie, dół na telefonie |

## 4. Teksty

- Po polsku, forma „ty”, bez wykrzykników w błędach, bez żargonu („generacja” → „grafika”).
- Przycisk mówi, co się stanie i ile kosztuje: „Generuj 3 grafiki”, „Wygeneruj opis (gratis)”,
  „Dokup 15 poprawek (1 kredyt)”.
- Komunikat błędu mówi, co zrobić: „Dokup pakiet albo edytuj opis ręcznie”.
- Tytuł karty przeglądarki: `<Ekran> – AllGrafika.pl` (`usePageTitle`).

## 5. Dostępność (NFR-A11Y)

- WCAG 2.1 AA; audyt axe w `frontend/e2e/a11y.spec.ts` na każdym ekranie i w modalach, naruszenia
  `serious`/`critical` blokują CI.
- Każde pole ma `<label for>`; przyciski-ikony mają `aria-label`; nawigacja ma `aria-current`;
  menu mobilne `aria-expanded`; widoczny fokus (`:focus-visible` ring).
- Modale: `role="dialog"`/`alertdialog`, `aria-modal`, `aria-labelledby`, Escape zamyka, fokus wchodzi do środka.
  Jedna implementacja: komponent `Modal` (aplikacja) i hook `useModalDialog`, którego identyczna kopia na
  landingu obsługuje ustawienia cookies (baner cookies też jest identyczny w obu pakietach). Hook prowadzi stos
  otwartych okien: tylko najwyższe reaguje na Escape i Tab, cała reszta strony (także okno pod spodem) dostaje
  atrybut `inert`, a po zamknięciu fokus wraca na element, który okno otworzył (jeśli zniknął – na element, który
  otworzył okno niżej w stosie). Tab i Shift+Tab krążą po elementach okna; grupa radio to jeden przystanek.
  Okno z nieprzerywalną operacją (np. trwające pisanie opisów) ignoruje Escape i kliknięcie tła.
  Toasty są poza `inert` (`data-dialog-keep`), żeby czytnik ekranu ogłaszał je także przy otwartym oknie.
- Eksport z niezapisanymi zmianami (obrót, korekta, plakietka) pyta przed zamknięciem – okno potwierdzenia
  otwiera się nad eksportem (zagnieżdżony modal).
- Menu „Więcej akcji” po wyborze pozycji oddaje fokus swojemu przyciskowi, więc okno otwarte z menu wraca
  fokusem na „Więcej akcji” danej karty.
- Pisownia: „e-mail” (etykiety „E-mail”, „adres e-mail”), nigdy „Email”/„email” w tekstach dla użytkownika.

## 5a. Limity przesyłania zdjęć (komunikaty)

API odrzuca przesłanie zdjęcia ponad limit (spec 04, decyzja z 2026-10-18): konto z niepotwierdzonym adresem –
łącznie 5 zdjęć (HTTP 403, `code: UPLOAD_LIMIT_UNCONFIRMED`), konto potwierdzone – 200 zdjęć w 24 godziny
(HTTP 429, `code: UPLOAD_DAILY_LIMIT`). Odpowiedź może podać `limit` (liczba) i moment odnowienia (`retryAt` jako
ISO 8601 albo `retryAfter` w sekundach; nagłówek `Retry-After` jest odczytywany, gdy przeglądarka go widzi).
Mapowanie kodów na teksty jest w jednym module (`frontend/src/utils/uploadLimits.ts`):

| Kod | Tytuł | Następny krok |
|---|---|---|
| `UPLOAD_LIMIT_UNCONFIRMED` | „Potwierdź adres e-mail, aby przesłać więcej zdjęć” | przycisk „Wyślij link ponownie”; po potwierdzeniu limit to 200 zdjęć na dobę |
| `UPLOAD_DAILY_LIMIT` | „Wykorzystano dzienny limit 200 zdjęć” | „Kolejne zdjęcia prześlesz dziś/jutro o HH:MM” albo „Spróbuj ponownie później” |

Komunikat jest alertem przy formularzu (nie toastem). Masowe przesyłanie zatrzymuje kolejkę: zdjęcie, które
dostało odmowę, i wszystkie następne wracają na listę jako oczekujące, więc wystarczy później kliknąć „Prześlij”.
Pozostałe błędy przesyłania (np. zły plik, awaria) wyglądają jak dotąd.
- Treść dynamiczna (walidacja) w regionach `aria-live="polite"` o stałej wysokości – brak skoków układu.

## 6. Kryteria akceptacji

- **AC-UI-001** – Given dowolny ekran aplikacji (zalogowany i niezalogowany), When uruchomiony jest audyt axe (WCAG 2.1 A/AA), Then nie ma naruszeń o wadze serious ani critical.
- **AC-UI-002** – Given otwarty modal eksportu lub okno potwierdzenia, When audyt axe, Then brak naruszeń serious/critical i modal ma rolę dialogu z nazwą.
- **AC-UI-003** – Given nieznany adres w aplikacji, When użytkownik go otworzy, Then widzi stronę 404 z linkiem na pulpit (strona startowa aplikacji).
- **AC-UI-004** – Given telefon (< 768 px), When użytkownik otworzy menu, Then przycisk ma `aria-expanded=true`, nawigacja działa, a po wyborze menu się zamyka.
- **AC-UI-005** – Given logowanie z błędnym hasłem, When wysłano formularz, Then błąd pojawia się w alercie przy formularzu (`role="alert"`), a nie w toaście, a toggle „Pokaż” odsłania hasło.
- **AC-UI-006** – Given dashboard lub galeria, When API zwróci błąd, Then widać alert „Nie udało się pobrać…” z przyciskiem „Spróbuj ponownie”, a stan pusty nie jest wyświetlany.
- **AC-UI-009** – Given aplikacja app.allgrafika.pl, When robot wyszukiwarki albo serwis społecznościowy pobiera dowolny adres, Then strona ma meta `noindex, nofollow`, hosting wysyła `X-Robots-Tag: noindex, nofollow`, `robots.txt` nie blokuje odczytu tych sygnałów, a link (np. polecający `/register?ref=…`) ma podgląd: `og:title`, `og:description` o sklepie internetowym i marketplace'ach oraz `og:image` z allgrafika.pl; strony publiczne (logowanie, rejestracja, regulamin, polityka) mają własne tytuły.
- **AC-UI-008** – Given komputer (≥ 1024 px) i strona dłuższa niż ekran, When użytkownik przewinie ją do końca, Then panel boczny zostaje w miejscu przy lewej krawędzi (logo, nawigacja, kredyty i „Wyloguj się” są widoczne), a przewija się tylko treść; gdy panel nie mieści się w oknie, przewija się sam.
- **AC-UI-007** – Given karta gotowej grafiki, When użytkownik otworzy „Więcej akcji”, Then widzi pozycje „Eksport i edycja” i „Przeróbka” i nie ma żadnej pozycji publikacji na zewnętrzny serwis (integracje usunięte, spec 08).
- **AC-UI-010** – Given dowolne okno modalne (eksport grafiki i oryginału, infografika, opisy dla zaznaczonych, oferta przy braku kredytów, potwierdzenie, szczegóły użytkownika w panelu admina, ustawienia cookies w aplikacji i na landingu), When otwarte, Then ma rolę `dialog`/`alertdialog` z `aria-modal` i niepustą nazwą, fokus jest w środku, Tab i Shift+Tab krążą wyłącznie po jego elementach, reszta strony ma `inert` (nie da się jej kliknąć ani osiągnąć klawiaturą), Escape zamyka okno (nie w trakcie nieprzerywalnej operacji), a po zamknięciu fokus wraca na element, który je otworzył.
- **AC-UI-011** – Given eksport z niezapisanymi zmianami (obrót, korekta lub plakietka), When użytkownik zamknie okno (Escape, „Zamknij” albo tło), Then nad eksportem otwiera się potwierdzenie; Escape i „Wróć do edycji” zamykają tylko potwierdzenie, fokus wraca do eksportu, a zmiany zostają; „Zamknij bez pobierania” zamyka oba okna, a fokus wraca na przycisk, który otworzył eksport; eksport bez zmian albo po pobraniu zamyka się bez pytania.
- **AC-UI-012** – Given każde okno z AC-UI-010 otwarte (także potwierdzenie nad eksportem), When uruchomiony jest audyt axe (WCAG 2.1 A/AA), Then nie ma naruszeń serious ani critical.
- **AC-UI-013** – Given formularze logowania, rejestracji i resetu hasła w aplikacji oraz formularz demo na landingu, When wyświetlone, Then pole adresu ma etykietę „E-mail” (nie „Email”), a komunikat walidacji brzmi „Podaj prawidłowy adres e-mail”.
- **AC-UI-014** – Given przesyłanie pojedyncze albo masowe, When API odrzuci zdjęcie kodem `UPLOAD_LIMIT_UNCONFIRMED` albo `UPLOAD_DAILY_LIMIT`, Then przy formularzu jest alert z polskim komunikatem i następnym krokiem (przycisk „Wyślij link ponownie” wysyłający link potwierdzający albo godzina, od której można przesłać kolejne zdjęcia, gdy API ją podało); masowe przesyłanie zatrzymuje się, a zdjęcie z odmową i następne czekają na liście; inne błędy przesyłania wyglądają jak dotąd (toast albo błąd przy pliku).
- **AC-UI-015** – Given kod aplikacji i landingu, When sprawdzony, Then każde okno modalne aplikacji korzysta ze wspólnego komponentu `Modal` (bez własnych nasłuchów Escape), hook `useModalDialog` i baner cookies są identyczne w obu pakietach, a kody limitów przesyłania są zdefiniowane tylko w `uploadLimits.ts`.
- **AC-UI-016** – Given ekran „Kredyty” w aplikacji, When API zwróci plany abonamentu, Then karty pokazują nazwę, cenę i opis z API (np. Start 19 zł / mies., Pro 59 zł / mies.), a kod aplikacji nie zawiera cen abonamentów wpisanych na sztywno.
