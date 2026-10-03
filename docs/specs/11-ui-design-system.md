# 11 – Język UI i wzorce UX

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-03 |
| Powiązane | NFR-A11Y-*, NFR-UX-*, `frontend/src/index.css`, `frontend/e2e/a11y.spec.ts` |

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
| `ConfirmDialog` + `useConfirm` | Potwierdzenia akcji destrukcyjnych |
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
- Treść dynamiczna (walidacja) w regionach `aria-live="polite"` o stałej wysokości – brak skoków układu.

## 6. Kryteria akceptacji

- **AC-UI-001** – Given dowolny ekran aplikacji (zalogowany i niezalogowany), When uruchomiony jest audyt axe (WCAG 2.1 A/AA), Then nie ma naruszeń o wadze serious ani critical.
- **AC-UI-002** – Given otwarty modal eksportu lub okno potwierdzenia, When audyt axe, Then brak naruszeń serious/critical i modal ma rolę dialogu z nazwą.
- **AC-UI-003** – Given nieznany adres w aplikacji, When użytkownik go otworzy, Then widzi stronę 404 z linkiem na dashboard.
- **AC-UI-004** – Given telefon (< 768 px), When użytkownik otworzy menu, Then przycisk ma `aria-expanded=true`, nawigacja działa, a po wyborze menu się zamyka.
- **AC-UI-005** – Given logowanie z błędnym hasłem, When wysłano formularz, Then błąd pojawia się w alercie przy formularzu (`role="alert"`), a nie w toaście, a toggle „Pokaż” odsłania hasło.
- **AC-UI-006** – Given dashboard lub galeria, When API zwróci błąd, Then widać alert „Nie udało się pobrać…” z przyciskiem „Spróbuj ponownie”, a stan pusty nie jest wyświetlany.
- **AC-UI-007** – Given karta gotowej grafiki, When użytkownik otworzy „Więcej akcji”, Then widzi pozycje „Eksport i edycja” i „Przeróbka”, a „Opublikuj na Allegro” tylko przy połączonym koncie.
