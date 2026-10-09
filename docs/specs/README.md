# Specyfikacje AllGrafika – proces Spec-Driven Development

Ten katalog jest **źródłem prawdy** o tym, co produkt robi i dlaczego. Kod, testy i dokumentacja API
wynikają ze specyfikacji, nie odwrotnie. Żadna zmiana zachowania nie wchodzi do `main` bez
zaktualizowanej specyfikacji i testu, który ją dowodzi.

## Jak czytać ten katalog

| Plik | Zawartość |
|---|---|
| [00-product.md](00-product.md) | Wizja, persony, cele biznesowe, co świadomie pomijamy |
| [01-requirements.md](01-requirements.md) | Wymagania funkcjonalne (FR) i niefunkcjonalne (NFR): wydajność, bezpieczeństwo, RODO, koszty |
| [02-pricing.md](02-pricing.md) | Model kredytów, pakiety, abonamenty, opisy, co jest darmowe |
| [03-auth-and-account.md](03-auth-and-account.md) | Rejestracja, logowanie, Google, sesja, reset i zmiana hasła, usunięcie konta |
| [04-upload-and-bulk.md](04-upload-and-bulk.md) | Pojedyncze i masowe przesyłanie zdjęć, walidacja plików |
| [05-generation.md](05-generation.md) | Style, kredyty za generację, kolejka, reconciler, własny styl, przeróbka, feedback |
| [06-export.md](06-export.md) | Formaty, kadrowanie, obrót, korekta, plakietka, pobieranie na telefonach |
| [07-descriptions.md](07-descriptions.md) | Opis oferty pod SEO: generowanie, poprawki, pakiety, sanitizacja HTML |
| [08-allegro.md](08-allegro.md) | Integracja OAuth, import i publikacja zdjęć |
| [09-payments.md](09-payments.md) | Stripe: pakiety, abonamenty, webhooki, prawo konsumenckie |
| [10-landing-seo.md](10-landing-seo.md) | Landing page: SSG, blog, przekierowania, budżety Lighthouse |
| [11-ui-design-system.md](11-ui-design-system.md) | Język UI: komponenty, klasy, wzorce, dostępność, ton komunikatów |
| [12-api.md](12-api.md) | Kontrakt API – OpenAPI generowany z kodu i wersjonowany w repo |
| [13-email-verification.md](13-email-verification.md) | Kanoniczny adres e-mail, potwierdzenie adresu, blokada darmowej puli, nadawca allgrafika.pl |
| [14-infographics.md](14-infographics.md) | Infografiki z cechami i wymiarami (zdjęcia dodatkowe) |
| [15-batch-actions.md](15-batch-actions.md) | Zaznaczanie w galerii, paczka ZIP, opisy hurtowo |
| [16-notifications-and-admin.md](16-notifications-and-admin.md) | Maile cykliczne ze zgodą i wypisaniem, panel administratora |
| [17-devices-performance-e2e.md](17-devices-performance-e2e.md) | Tablety, budżety wydajności, poprawki UX, test full-stack na prawdziwym backendzie |
| [18-mobile-apps.md](18-mobile-apps.md) | Aplikacje Android i iOS (Capacitor), sesja Bearer, zakupy przez stronę, info na landingu |
| [19-monetization.md](19-monetization.md) | Darmowa pula 5, pakiet powitalny, oferta przy braku kredytów, ponowienie płatności, kredyty od admina |
| [adr/](adr/) | Architecture Decision Records – decyzje, których nie da się wyczytać z kodu |
| [TEMPLATE-feature-spec.md](TEMPLATE-feature-spec.md) | Szablon nowej specyfikacji |
| [glossary.md](glossary.md) | Słownik pojęć (Kredyt, Grafika, Opis oferty, Poprawka…) |

## Identyfikatory i śledzenie (traceability)

- Każde wymaganie ma identyfikator `FR-<OBSZAR>-<NNN>` albo `NFR-<OBSZAR>-<NNN>`.
- Każde kryterium akceptacji ma identyfikator `AC-<OBSZAR>-<NNN>` i jest napisane tak, aby dało się je
  jednoznacznie sprawdzić testem.
- Test, który dowodzi kryterium, ma identyfikator w nazwie, np. `it('[AC-DESC-003] …')` lub
  `test('[AC-EXP-002] …')`. Jeden test może dowodzić kilku kryteriów, jedno kryterium może mieć kilka testów.
- `node scripts/check-spec-coverage.js` (uruchamiany w CI, job `specs`) sprawdza, że:
  1. każde `AC-…` ze specyfikacji występuje w co najmniej jednym teście,
  2. każde `[AC-…]` w testach istnieje w specyfikacji (brak „osieroconych” odwołań),
  3. identyfikatory są unikalne.
  Raport: `node scripts/check-spec-coverage.js --report` wypisuje macierz AC → testy.

## Przepływ pracy (Definition of Ready / Done)

1. **Spec first.** Nowa funkcja lub zmiana zachowania zaczyna się od PR-a ze zmianą w `docs/specs/`
   (nowy plik ze szablonu albo edycja istniejącego). Opisujemy: problem, decyzje, kryteria akceptacji,
   wpływ na cennik, regulamin, API, UI i NFR. Jeśli decyzja jest architektoniczna – dodajemy ADR.
2. **Review specyfikacji** przez właściciela produktu (Mateusz). Dopiero po akceptacji piszemy kod.
3. **Testy z identyfikatorami AC** powstają razem z implementacją (backend: Jest/supertest, frontend:
   Vitest + Playwright, landing: Playwright). Test bez AC w nazwie jest dozwolony tylko dla szczegółów
   implementacyjnych, nie dla zachowania widocznego dla użytkownika.
4. **Kontrakt API**: jeśli zmienia się endpoint, `docs/api/openapi.json` musi być przegenerowany
   (`cd backend && npm run openapi`); CI odrzuca PR z nieaktualnym plikiem.
5. **Regulamin i cennik**: zmiana ceny lub zasad = zmiana `02-pricing.md`, obu kopii `RegulaminContent.tsx`
   i tekstów na landingu w tym samym PR (test `legal-copies-identical` pilnuje spójności kopii).
6. **Definition of Done**: specyfikacja zaktualizowana, `check-spec-coverage` zielony, wszystkie suity
   zielone (backend unit + e2e, frontend unit + Playwright 4 profile + axe, landing build + hydratacja),
   README/CHANGELOG zaktualizowane, PR z wypełnionym szablonem.

## Konwencje pisania

- Język specyfikacji: polski (produkt dla polskich sprzedawców), identyfikatory i nazwy techniczne po angielsku.
- Kryteria akceptacji w formie **Given / When / Then** (Gherkin) albo jednozdaniowego warunku mierzalnego.
- Każdy plik ma nagłówek ze statusem (`Draft` / `Accepted` / `Deprecated`), datą i właścicielem.
- Nie opisujemy implementacji (nazw funkcji, plików), chyba że jest to ograniczenie techniczne.
