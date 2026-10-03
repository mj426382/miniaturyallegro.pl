# Jak pracujemy nad AllGrafika

Projekt jest prowadzony w modelu **Spec-Driven Development**: najpierw specyfikacja w
[docs/specs/](docs/specs/README.md), potem testy z identyfikatorami kryteriów akceptacji, potem kod.
Pełny opis procesu, identyfikatorów i Definition of Done jest w `docs/specs/README.md`.

## Szybka ściąga

```bash
# 1. Nowa funkcja: skopiuj szablon i opisz ją
cp docs/specs/TEMPLATE-feature-spec.md docs/specs/13-moja-funkcja.md

# 2. Testy z AC w nazwie, np. it('[AC-XYZ-001] …')
cd backend && npm run test:db:up && npm run test:all
cd frontend && npm test && npx playwright test
cd landing-page && npm run build && npx playwright test

# 3. Kontrakt API i śledzenie specyfikacji
cd backend && npm run openapi            # odświeża docs/api/openapi.json
node scripts/check-spec-coverage.js --report
```

## Gałęzie i PR-y

- `main` jest zawsze wdrażalny; CI musi być zielone (backend, frontend, landing, specs).
- Jeden PR = jedna zmiana zachowania + jej specyfikacja + testy. Szablon PR-a wymusza checklistę.
- Bot bloga tworzy własne PR-y (auto-merge po zielonym CI).

## Czego nie robimy

- Nie zmieniamy ceny ani zasad w kodzie bez `docs/specs/02-pricing.md` i regulaminu.
- Nie usuwamy adresów URL bloga bez przekierowania 301 (`landing-page/scripts/check-redirects.js`).
- Nie commitujemy sekretów; `.env` jest ignorowany, przykłady w `*.env.example`.
