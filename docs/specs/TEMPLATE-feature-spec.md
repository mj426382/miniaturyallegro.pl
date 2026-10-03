# <Nazwa funkcji>

| Pole | Wartość |
|---|---|
| Status | Draft |
| Właściciel | Mateusz Janduła |
| Data | RRRR-MM-DD |
| Powiązane | FR-…, NFR-…, ADR-…, inne specyfikacje |

## 1. Problem i cel

Dla kogo, jaki problem rozwiązujemy, po czym poznamy sukces (metryka).

## 2. Zakres

- W zakresie: …
- Poza zakresem (świadomie): …

## 3. Decyzje produktowe

Cennik, limity, domyślne wartości, co jest płatne, co darmowe. Każda decyzja z uzasadnieniem.

## 4. Przepływ użytkownika (UX)

Ekran po ekranie, stany: pusty, ładowanie, błąd, sukces. Teksty przycisków i komunikatów po polsku.
Odwołania do wzorców z `11-ui-design-system.md`.

## 5. Wymagania funkcjonalne

- **FR-<OBSZAR>-NNN** – …

## 6. Kryteria akceptacji

- **AC-<OBSZAR>-NNN** – Given … When … Then …

## 7. API

Endpointy, metody, kody odpowiedzi, walidacja, limity (rate limit), uprawnienia. Po implementacji
kontrakt jest w `docs/api/openapi.json`.

## 8. Dane i migracje

Nowe tabele/kolumny, zgodność wsteczna z istniejącymi wierszami w produkcji.

## 9. Wymagania niefunkcjonalne

Wydajność, koszty AI, bezpieczeństwo, RODO, dostępność, i18n.

## 10. Wpływ na dokumenty

Regulamin (§), polityka prywatności, landing (cennik/FAQ), README.

## 11. Ryzyka i pytania otwarte

## 12. Plan testów

Które AC pokrywa jaki rodzaj testu (unit / integracyjny / przeglądarkowy / live AI).
