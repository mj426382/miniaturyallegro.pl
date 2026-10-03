## Co i dlaczego

<!-- Jedno-dwa zdania. Link do specyfikacji w docs/specs/ (sekcja lub AC), której dotyczy zmiana. -->

Specyfikacja: `docs/specs/…` (AC-…)

## Checklist Spec-Driven Development

- [ ] Specyfikacja zaktualizowana **przed** kodem (nowe/zmienione FR i AC mają identyfikatory)
- [ ] Każde nowe/zmienione AC ma test z `[AC-…]` w nazwie (`node scripts/check-spec-coverage.js` zielony)
- [ ] Zmiana API → `docs/api/openapi.json` przegenerowany (`cd backend && npm run openapi`)
- [ ] Zmiana ceny/zasad → `02-pricing.md`, obie kopie `RegulaminContent.tsx`, landing (cennik/FAQ)
- [ ] Zmiana UI → zgodna z `11-ui-design-system.md` (klasy współdzielone, stany błędów, etykiety, kontrast)
- [ ] Migracja Prisma jest zgodna wstecz z danymi produkcyjnymi
- [ ] Testy: backend (unit + e2e), frontend (Vitest + Playwright 4 profile + axe), landing (build + hydratacja)
- [ ] README / ADR zaktualizowane, jeśli zmieniło się coś, czego nie widać w kodzie

## Jak przetestować ręcznie

<!-- Kroki dla reviewera. -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
