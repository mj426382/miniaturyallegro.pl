# 26 – IndexNow: powiadamianie wyszukiwarek po wdrożeniu landingu

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-19 |
| Powiązane | spec 10 (sitemapa, AC-SEO-018), spec 23 (bot bloga), `landing-page/scripts/indexnow.js`, `.github/workflows/indexnow.yml`, https://www.indexnow.org/documentation |

## 1. Problem i cel

Nowe wpisy bloga (bot publikuje pon/śr/pt) i zmienione strony docelowe czekają na ponowne odwiedziny robota.
IndexNow pozwala jednym żądaniem powiadomić Bing, Yandex, Seznam i Naver (wyszukiwarki dzielą się zgłoszeniami),
że adres się zmienił. Google IndexNow nie obsługuje – dla niego zostaje sitemapa i Search Console.

Cel: po każdym udanym wdrożeniu produkcyjnym landingu (`allgrafika.pl`) zgłosić dokładnie te adresy, które się
zmieniły, bez ręcznej pracy i bez ryzyka, że błąd zgłoszenia zablokuje wdrożenie.

## 2. Zakres

- W zakresie: klucz IndexNow w `landing-page/public/`, skrypt `landing-page/scripts/indexnow.js`, workflow
  `.github/workflows/indexnow.yml` uruchamiany statusem wdrożenia Vercel i ręcznie.
- Poza zakresem: Google Indexing API (tylko dla ofert pracy i transmisji), aplikacja `app.allgrafika.pl`
  (noindex), zgłaszanie adresów spoza sitemapy.

## 3. Decyzje

- **Klucz jest publiczny z założenia.** IndexNow weryfikuje własność przez plik `https://allgrafika.pl/<klucz>.txt`
  zawierający sam klucz. Klucz (32 znaki hex, losowy) jest w repozytorium jako `landing-page/public/<klucz>.txt`
  i nie jest sekretem. Skrypt znajduje go po nazwie pliku – jedno źródło, brak stałej w kodzie i w workflow.
  Plik jest statyczny (Vite kopiuje `public/` do `dist/`), `vercel.json` nie ma rewrite SPA, więc Vercel serwuje
  go jako `text/plain`. Sitemapa go nie zawiera (generator sitemapy wymienia tylko trasy HTML).
- **Źródłem zmian jest sitemapa z repozytorium**, nie lista commitów: `landing-page/public/sitemap.xml` jest
  commitowana, a każdy `<lastmod>` to data zmiany treści (spec 10). Skrypt porównuje sitemapę w commicie wdrożenia
  z sitemapą w commicie poprzedniego udanego wdrożenia produkcyjnego i zgłasza adresy:
  nowe, ze zmienionym `<lastmod>` oraz usunięte z sitemapy (IndexNow przyjmuje adresy usunięte – odpowiadają 404
  albo 301, co wyszukiwarka też powinna zobaczyć). Adresy bez zmian nie są zgłaszane (IndexNow zniechęca do
  ponownego zgłaszania niezmienionych adresów).
- **Poprzednie wdrożenie** ustala workflow przez GitHub API (wdrożenia tworzy integracja Vercel z GitHubem,
  środowisko „Production – miniaturyallegro-pl”; aplikacja ma osobne środowisko „Production – miniaturyallegro-ui”,
  które jest pomijane): najnowsze wdrożenie tego samego środowiska starsze od bieżącego, które ma status `success`.
  Ponowne wdrożenie tego samego commita daje pustą różnicę – nic nie jest wysyłane. Gdy poprzedniego wdrożenia nie ma
  (pierwsze uruchomienie) albo jego sitemapy nie da się odczytać, skrypt zgłasza adresy z `<lastmod>` z ostatnich 7 dni.
- **Wdrożenie nigdy nie zależy od IndexNow.** Workflow działa po wdrożeniu (zdarzenie `deployment_status`), a skrypt
  kończy się kodem 0 przy każdym błędzie sieci lub odpowiedzi IndexNow – błąd jest w logu i w podsumowaniu przebiegu
  jako ostrzeżenie. Kod różny od 0 tylko przy błędnych argumentach wywołania (błąd programisty).
- **Ponowienia:** 429, 5xx i błędy sieci są ponawiane do 3 prób łącznie z wykładniczym odstępem (2 s, 4 s, …),
  z poszanowaniem nagłówka `Retry-After` (maks. 60 s). 400, 403 i 422 nie są ponawiane (to błąd żądania albo klucza).
- **Przed wysłaniem** skrypt pobiera `keyLocation`; jeśli nie zwraca 200 z samym kluczem (np. CDN jeszcze nie
  przełączył domeny), zgłoszenie jest pomijane z ostrzeżeniem – wysłanie bez działającego klucza skończyłoby się 403.
- **Współbieżność:** zadanie ma grupę współbieżności `indexnow-landing` bez anulowania, więc wdrożenia jedno po
  drugim są przetwarzane po kolei i każde porównuje się z poprzednim – zakresy się nie nakładają. Znane ograniczenie:
  GitHub trzyma w kolejce tylko jedno oczekujące uruchomienie, więc przy trzech wdrożeniach w ciągu ok. minuty
  środkowe może zostać pominięte (jego zmiany nie zostaną zgłoszone; sitemapa nadal je ma).
- **Ręczne uruchomienie** (`workflow_dispatch`): opcjonalny `since` (sha, od którego liczyć zmiany) i `dry_run`
  (domyślnie włączony – ręczny przebieg najpierw pokazuje, co by wysłał). Bez `since` punktem odniesienia jest
  najnowsze udane wdrożenie produkcyjne innego commita niż bieżący.

## 4. Kryteria akceptacji

- **AC-SEO-028** – Given `landing-page/public`, When sprawdzony klucz IndexNow, Then istnieje dokładnie jeden plik `<klucz>.txt` z kluczem 32 znaków `[0-9a-f]`, którego treść to sam klucz (bez innych znaków); po buildzie plik jest w `dist/`, serwer podglądu zwraca go pod `/<klucz>.txt` z kodem 200, typem `text/plain` i treścią równą kluczowi; `vercel.json` nie ma przekierowania, rewrite ani nagłówka obejmującego ten adres, a sitemapa i lista prerenderowanych tras nie zawierają pliku klucza.
- **AC-SEO-029** – Given poprzednia i bieżąca sitemapa, When skrypt liczy adresy do zgłoszenia, Then zgłasza adresy nowe, ze zmienionym `<lastmod>` i usunięte z sitemapy, pomija adresy bez zmian i adresy spoza `https://allgrafika.pl` (inne domeny, `www`, `http`), każdy adres występuje raz (także gdy sitemapa ma duplikaty), a encje XML w `<loc>` są dekodowane.
- **AC-SEO-030** – Given brak poprzedniego wdrożenia, nieczytelna poprzednia sitemapa albo nieznany commit, When skrypt działa, Then zgłasza tylko adresy z `<lastmod>` z ostatnich 7 dni; Given nieczytelna bieżąca sitemapa (np. brak `<urlset>`, niedomknięty `<url>`, `<url>` bez `<loc>`), When skrypt działa, Then nic nie wysyła, loguje błąd i kończy się kodem 0; Given brak zmian, Then kończy się kodem 0 z komunikatem, że nie ma nic do wysłania.
- **AC-SEO-031** – Given adresy do zgłoszenia, When skrypt wysyła zgłoszenie, Then robi `POST https://api.indexnow.org/indexnow` z `Content-Type: application/json; charset=utf-8` i ciałem dokładnie `{host, key, keyLocation, urlList}` (`host` = `allgrafika.pl`, `keyLocation` = `https://allgrafika.pl/<klucz>.txt`), a ponad 10 000 adresów dzieli na kolejne żądania po maks. 10 000.
- **AC-SEO-032** – Given odpowiedź IndexNow, When 200 lub 202, Then zgłoszenie jest udane; When 400, 403 lub 422, Then skrypt loguje zrozumiały powód i nie ponawia; When 429, 5xx lub błąd sieci, Then ponawia do 3 prób z rosnącym odstępem (z `Retry-After`, gdy podany, maks. 60 s); w każdym z tych przypadków proces kończy się kodem 0, a w GitHub Actions błąd jest ostrzeżeniem w logu i w podsumowaniu przebiegu.
- **AC-SEO-033** – Given `keyLocation` nie zwraca 200 z samym kluczem (inny kod, inna treść, błąd sieci), When skrypt ma wysłać zgłoszenie, Then pomija wysyłkę z ostrzeżeniem i kodem 0 (bez żądania do IndexNow).
- **AC-SEO-034** – Given `--dry-run`, When skrypt działa, Then wypisuje skąd pochodzi porównanie, listę adresów z powodem (nowy, zmieniony, usunięty, ostatnie 7 dni) i ciało każdego żądania, które by wysłał, informuje o stanie pliku klucza i nie wysyła żadnego żądania do IndexNow.
- **AC-SEO-035** – Given wdrożenia środowiska „Production – miniaturyallegro-pl” w GitHub API, When skrypt szuka poprzedniego wdrożenia, Then wybiera najnowsze wdrożenie tego środowiska starsze od bieżącego, które ma status `success` (pomija nieudane i bieżące), dla ręcznego przebiegu bez `since` – najnowsze udane wdrożenie innego commita, a gdy żadnego nie ma albo API zwraca błąd – przechodzi w tryb „ostatnie 7 dni”.
- **AC-SEO-036** – Given `.github/workflows/indexnow.yml`, When sparsowany, Then reaguje na `deployment_status` i `workflow_dispatch` (wejścia `since` i `dry_run`), zadanie działa tylko dla stanu `success` środowiska „Production – miniaturyallegro-pl” albo ręcznie, ma uprawnienia wyłącznie `contents: read` i `deployments: read`, grupę współbieżności bez anulowania, checkout commita wdrożenia z pełną historią, Node 24 i uruchamia `landing-page/scripts/indexnow.js`.
