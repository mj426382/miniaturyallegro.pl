# Google Analytics 4 – zgoda per kategoria i pomiar ścieżki z reklamy

| Pole | Wartość |
|---|---|
| Status | Draft |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-12 |
| Powiązane | 21-google-ads, 10-landing-seo, 09-payments, 18-mobile-apps, polityka prywatności (§ 3–5) |

## 1. Problem i cel

Właściciel promuje allgrafika.pl kampaniami Google Ads. Konwersje Ads (spec 21) mówią, ile rejestracji
i zakupów dała reklama, ale nie pokazują ścieżki: które strony i przyciski prowadzą do rejestracji, jaki
jest przychód z kampanii i gdzie użytkownicy odpadają. Cel: Google Analytics 4 na allgrafika.pl
i app.allgrafika.pl, w tym samym tagu Google co Ads, wyłącznie za zgodą na cookies analityczne.
Metryka: przychód (`purchase`) i rejestracje (`sign_up`) w GA4 przypisane do kampanii Google Ads.

## 2. Zakres

- W zakresie: kategorie zgody (niezbędne, analityczne, marketingowe), migracja zapisanej decyzji ze spec 21,
  GA4 (`G-C3NE5EW4ED`) w jednym ładowaniu gtag.js z Google Ads, `page_view` przy zmianie trasy,
  zdarzenia `cta_click`, `generate_lead` (landing), `sign_up`, `begin_checkout`, `purchase` (aplikacja),
  polityka prywatności.
- Poza zakresem: Google Tag Manager, enhanced conversions, User-ID, Google Signals, remarketing z GA4,
  aplikacje Android/iOS (tag nigdy nie działa w aplikacji natywnej – spec 18), nagłówki CSP (oba projekty
  Vercel nie mają dziś CSP, więc nic nie blokuje Google; pełne CSP to osobna zmiana).

## 3. Decyzje produktowe

- **Kategorie.** Niezbędne – zawsze (cookie `ag_consent`, sesja). Analityczne – GA4 (`analytics_storage`).
  Marketingowe – Google Ads (`ad_storage`, `ad_user_data`, `ad_personalization`). Baner: „Odrzucam”,
  „Dostosuj”, „Akceptuję”; „Odrzucam” i „Akceptuję” tej samej wielkości. „Dostosuj” i „Ustawienia cookies”
  (stopka, polityka) pokazują pola wyboru – żadne nie jest zaznaczone z góry, poza wcześniej udzieloną zgodą.
- **Tryb podstawowy Consent Mode, jak w spec 21.** Skrypt Google nie ładuje się, dopóki żadna kategoria
  nieniezbędna nie jest przyznana. Potem: `consent default` = wszystko `denied`, `consent update` według
  kategorii. Każdy produkt jest konfigurowany (`config`) dopiero po zgodzie na jego kategorię – przy zgodzie
  tylko na Ads GA4 nie wysyła nawet pingów bez cookies, przy zgodzie tylko na analitykę tag Ads nie działa
  (dodatkowo `ads_data_redaction`). Tryb zaawansowany (pingi bez zgody) świadomie odrzucony – spójnie
  z dotychczasową implementacją i rygorem ISO 27001 firmy.
- **Jeden tag Google.** Jedno `gtag/js` (id pierwszego przyznanego produktu), oba `config` w tej samej
  kolejce `dataLayer`, ten sam stan zgody. Zgoda udzielona później dokłada `config`, nie drugi skrypt.
- **Identyfikator GA4** `G-C3NE5EW4ED` jest publiczny i zapisany w kodzie; `VITE_GA4_ID` go nadpisuje,
  wartość niebędąca „G-…” (np. `off`) wyłącza GA4. Google Ads dalej wymaga `VITE_GOOGLE_ADS_ID`.
- **Zapis decyzji (wersja 2).** Cookie `ag_consent` na `.allgrafika.pl`, 180 dni:
  `ads=1&analytics=0&v=2`. `ads=` zostaje na początku, więc nieprzebudowana jeszcze druga aplikacja (spec 21
  czyta `ads=([01])`) widzi decyzję o Ads. Kategoria nieskonfigurowana na danej domenie zachowuje decyzję
  z drugiej domeny.
- **Migracja z wersji 1** (`ads=1` / `ads=0`). Decyzja o Ads obowiązuje dalej bez zmian (kto zaakceptował
  Ads, ma działające konwersje od pierwszej strony – nie traci zgody po cichu). Zgody na analitykę z wersji 1
  nie da się wywieść, więc baner pojawia się ponownie z informacją „Dodaliśmy nową kategorię…”, a w
  „Dostosuj” zaznaczona jest tylko dotychczasowa zgoda marketingowa.
- **Odsłony.** `config` GA4 ma `send_page_view: false`; aplikacje wysyłają `page_view` przy pierwszym
  renderze i każdej zmianie trasy (ścieżka lub query), po aktualizacji tytułu strony. Adres strony
  (`page_location`, także przez `set` dla pozostałych trafień) jest czyszczony: bez `#` i bez parametrów
  innych niż kampanijne (`utm_*`, `gclid`, `gbraid`, `wbraid`, `dclid`, `gad_source`, `gad_campaignid`,
  `srsltid`) – tokeny resetu hasła, potwierdzenia e-maila, wypisu, identyfikator darmowej próby,
  kod polecenia i adresy e-mail nigdy nie trafiają do Google.
- **Wycofanie zgody** na analitykę: `consent update` z `analytics_storage: denied`, flaga
  `window['ga-disable-<ID>']`, usunięcie cookies `_ga` i `_ga_*`. Pliki `_ga` żyją maks. 400 dni
  (`cookie_expires`), dane w GA4 – 14 miesięcy (ustawienie w panelu, § 8).
- **Zdarzenia GA4** – tylko do GA4 (`send_to: G-…`), tylko przy zgodzie analitycznej, bez danych osobowych:

  | Zdarzenie | Gdzie | Parametry |
  |---|---|---|
  | `page_view` | landing, aplikacja | `page_location` (oczyszczony), `page_title` |
  | `cta_click` | landing: przyciski do aplikacji i do dema | `location` (`navbar`, `navbar_mobile`, `hero`, `final_cta`, `pricing_plan`, `pricing_package`, `seo_hero`, `seo_final_cta`, `blog_post`, `mobile_teaser`, `demo_result`), `destination` (`register`, `credits`, `demo`) |
  | `generate_lead` | landing: wysłany formularz darmowej próby | `lead_source: demo` |
  | `sign_up` | aplikacja: konto założone (e-mail / Google) | `method` |
  | `begin_checkout` | aplikacja: przed przekierowaniem do Stripe | `currency: PLN`, `value`, `items[{item_id, price, quantity}]` |
  | `purchase` | aplikacja: powrót z udanej płatności | `transaction_id` (losowe `ag-<uuid>` z rozpoczęcia płatności), `currency: PLN`, `value`, `items` |

- **Bez podwójnego liczenia z Google Ads.** Konwersje Ads zostają jak w spec 21 (`conversion` z
  `send_to = AW-…/<etykieta>`, tylko przy zgodzie marketingowej) i nie trafiają do GA4; zdarzenia GA4 nie
  trafiają do Ads. Mapowanie: Ads „Rejestracja” ↔ GA4 `sign_up`, Ads „Zakup” ↔ GA4 `purchase` (ta sama
  wartość w PLN). W Google Ads **nie** importujemy `sign_up`/`purchase` z GA4 jako konwersji podstawowych
  (najwyżej jako dodatkowe – „secondary”), inaczej każda konwersja liczyłaby się dwa razy. `purchase` w GA4
  jest wysyłany tylko z zapamiętanym `transaction_id` (GA4 deduplikuje po nim); konwersja Ads, jak dotąd,
  także bez wartości.

## 4. Przepływ użytkownika (UX)

Pierwsza wizyta: pasek u dołu ekranu „Używamy plików cookies Google Analytics (statystyki odwiedzin)
i Google Ads (pomiar skuteczności reklam). Włączymy je tylko za Twoją zgodą; niezbędne pliki działają
zawsze…” + „Polityka prywatności”, przyciski „Odrzucam”, „Dostosuj”, „Akceptuję”. „Dostosuj” zamienia pasek
w listę kategorii z polami wyboru (Niezbędne – zaznaczone, nieaktywne) i przyciskami „Odrzucam”,
„Zapisz wybór”, „Akceptuję”. Na telefonie pasek ma maks. 85% wysokości ekranu i przewija się.
Baner nie jest w prerenderowanym HTML.

## 5. Wymagania funkcjonalne

- **FR-GA-001** – Zgoda per kategoria; tag Google tylko po zgodzie na co najmniej jedną kategorię nieniezbędną.
- **FR-GA-002** – GA4 i Ads w jednym ładowaniu gtag.js, każdy skonfigurowany tylko przy swojej zgodzie.
- **FR-GA-003** – Migracja decyzji z wersji 1 bez cichej utraty zgody na Ads.
- **FR-GA-004** – `page_view` przy zmianie trasy z oczyszczonym adresem; zdarzenia z tabeli § 3 bez danych osobowych.
- **FR-GA-005** – `purchase` w aplikacji z `transaction_id`, `value`, `currency: PLN`; bez podwójnego liczenia w Ads.

## 6. Kryteria akceptacji

- **AC-GA-001** – Given brak decyzji, When pierwsza wizyta, Then baner wymienia Google Analytics i Google Ads,
  „Dostosuj” pokazuje kategorie Niezbędne (zaznaczona, nieaktywna), Analityczne i Marketingowe (niezaznaczone),
  a do domen Google nie poszło żadne żądanie. GA4 jest domyślnie włączone z identyfikatorem `G-C3NE5EW4ED`.
- **AC-GA-002** – Given baner, When „Odrzucam”, Then `ag_consent=ads=0&analytics=0&v=2` i żadne żądanie do
  Google ani wpis w `dataLayer` – także po przejściu na inną stronę i przeładowaniu.
- **AC-GA-003** – Given baner, When „Dostosuj” → tylko „Analityczne” → „Zapisz wybór”, Then jedno żądanie
  `gtag/js?id=<GA4>`, `consent update` z `analytics_storage: granted` i `ad_*: denied`, `config` GA4
  z `send_page_view: false`, brak `config` Ads i brak żądań do googleadservices/doubleclick, jedna `page_view`.
- **AC-GA-004** – Given baner, When „Akceptuję”, Then dokładnie jeden skrypt gtag.js, `config` GA4 i Ads,
  wszystkie zgody `granted`, `page_view` tylko z `send_to` GA4; zgoda na drugą kategorię później nie ładuje
  drugiego skryptu.
- **AC-GA-005** – Given zapisane `ads=1` (wersja 1), When wizyta, Then tag Ads działa od razu
  (`ad_*: granted`, `analytics_storage: denied`), a baner pyta ponownie z informacją o nowej kategorii
  i zaznaczonym „Marketingowe”; Given `ads=0`, Then nic się nie ładuje i baner pyta ponownie.
- **AC-GA-006** – Given zgoda analityczna, When wejście na stronę z parametrami (np. `utm_source`, `gclid`,
  `token`, `email`) i przejście na inną trasę, Then po jednej `page_view` na trasę, `page_location` zawiera
  tylko parametry kampanijne, a `dataLayer` nie zawiera tokenu ani e-maila; bez zgody – żadnej `page_view`.
- **AC-GA-007** – Given zgoda analityczna, When klik w CTA albo wysłanie formularza darmowej próby, Then
  `cta_click` z `location` i `destination` albo `generate_lead` z `lead_source: demo`, `send_to` GA4,
  bez e-maila i bez zdarzenia `conversion`; bez zgody analitycznej – nic.
- **AC-GA-008** – Given zgoda na obie kategorie, When „Ustawienia cookies” → odznaczenie „Analityczne” →
  „Zapisz wybór”, Then `ag_consent=ads=1&analytics=0&v=2`, `consent update` z `analytics_storage: denied`
  i `ad_*: granted`, `ga-disable-<GA4>` = true, cookies `_ga*` usunięte, kolejne zdarzenia GA4 nie są wysyłane.
- **AC-GA-009** – Given zgoda analityczna w aplikacji, When rozpoczęcie płatności i powrót z sukcesem, Then
  `begin_checkout` i dokładnie jedno `purchase` z `transaction_id`, `value`, `currency: PLN`, `items`; konwersja
  Ads osobno (tylko przy zgodzie marketingowej); bez zgody analitycznej – brak zdarzeń GA4; zapamiętana
  płatność ze starszej wersji (sama kwota) daje tylko konwersję Ads.

## 7. API

Brak zmian w backendzie (transakcja ma losowy identyfikator po stronie przeglądarki; możliwe rozszerzenie:
`session_id={CHECKOUT_SESSION_ID}` w `success_url` Stripe).

## 8. Dane i prywatność

Polityka prywatności: § 3 (cel „statystyki odwiedzin, kampanii i zakupów”, podstawa art. 6 ust. 1 lit. a RODO,
14 miesięcy), § 4 (Google Ireland Ltd. / Google LLC – Google Analytics 4, transfer w ramach EU-U.S. DPF),
§ 5 (`ag_consent` jako niezbędne; `_ga`, `_ga_<ID>` do 13 miesięcy; zakres danych; wycofanie zgody).
Zmiana wymaga zgody, więc nie pogarsza sytuacji użytkownika i obowiązuje od publikacji.

**Ustawienia w panelu GA4 (właściciel, jednorazowo):**
1. Administracja → Przechowywanie danych → 14 miesięcy (domyślnie 2).
2. Strumień danych → Pomiar zaawansowany → Odsłony → wyłączyć „Zmiany na stronie na podstawie zdarzeń
   historii przeglądania” (odsłony SPA wysyłamy sami – inaczej liczyłyby się podwójnie).
3. Konfiguracja tagu → Lista niechcianych odesłań: `checkout.stripe.com` (powrót z płatności nie może zaczynać
   nowej sesji z „referral”, bo `purchase` straciłby źródło – kampanię Ads).
4. Połączenie GA4 ↔ Google Ads; wymiary niestandardowe (zakres: zdarzenie): `location`, `destination`, `lead_source`.
5. Google Signals wyłączone.

## 9. Testy

AC-GA-001..008 – Playwright na landingu (`e2e/google-analytics.spec.ts`, build z `G-TEST` i `AW-TEST`,
żądania do Google przechwytywane) oraz testy jednostkowe modułu w aplikacji (vitest,
`src/consent/googleTag.test.ts`). AC-GA-009 – vitest (`src/utils/checkout.test.ts`). Moduł zgody
(`consent/googleTag.ts`, `CookieBanner.tsx`, `PageViewTracker.tsx`) jest identyczny w obu projektach.
