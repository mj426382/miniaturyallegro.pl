# ADR-0005: Landing jako SSG z prerenderem, wieczne adresy bloga, podgląd zgodny z Vercel

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Data | 2026-10-02 |

## Kontekst

Landing był SPA z rewrite na `index.html`: każdy adres zwracał 200 z pustym `<div id="root">`, Google
indeksował duplikaty bloga tworzone przez bota, a Lighthouse mobile miał 55–72 punktów.

## Decyzja

- Vite SSR + `scripts/prerender.js` zapisują `dist/<trasa>/index.html` z pełnym `<head>` (react-helmet-async).
  Treści wpisów są ładowane leniwie (`import.meta.glob`), więc główny bundle nie rośnie z blogiem.
- `vercel.json`: `trailingSlash:false`, bez rewrite SPA, 404 dla nieznanych adresów, tablica 301 dla
  zlikwidowanych slugów; `check-redirects.js` przerywa build, gdy slug zniknął bez przekierowania.
- `vite preview` dostał plugin serwujący prerenderowane pliki jak Vercel – inaczej testy hydratacji
  i Lighthouse mierzyły stronę główną zamiast właściwej trasy (fałszywe błędy #418/#423).
- Bot bloga tworzy PR (nie commituje na `main`), waliduje slug, kategorię i nieudokumentowane procenty.

## Konsekwencje

- Build landingu trwa dłużej (72 trasy), ale Lighthouse mobile: 99 / 98 / 93, SEO 100.
- Każda nowa trasa musi trafić do listy prerenderu i do sitemapy.
