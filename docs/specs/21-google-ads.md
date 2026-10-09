# Google Ads – zgoda na cookies i pomiar konwersji

| Pole | Wartość |
|---|---|
| Status | Approved |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-09 |
| Powiązane | 10-landing-seo, 19-monetization, 09-payments, polityka prywatności (§ 3–5) |

## 1. Problem i cel

Ruch organiczny rośnie wolno, a właściciel chce uruchomić kampanie Google Ads. Bez pomiaru konwersji
Google nie optymalizuje stawek, a bez zgody użytkownika nie wolno zapisywać reklamowych cookies
(art. 399 Prawa komunikacji elektronicznej, RODO art. 6 ust. 1 lit. a). Cel: rejestracja i zakup są
mierzone jako konwersje Google Ads wyłącznie u osób, które zgodziły się na cookies reklamowe.

## 2. Zakres

- W zakresie: baner zgody na allgrafika.pl i app.allgrafika.pl (wspólna decyzja dla obu domen),
  Google Consent Mode v2, tag Google Ads, konwersje „Rejestracja” i „Zakup”, polityka prywatności.
- Poza zakresem: Google Analytics 4, remarketing list z danych konta (Customer Match), aplikacje
  mobilne (tag nigdy nie działa w aplikacji Android/iOS – spec 18), Meta Pixel.

## 3. Decyzje produktowe

- **Tryb podstawowy Consent Mode** – skrypt Google (`googletagmanager.com/gtag/js`) w ogóle się nie
  ładuje przed zgodą; po zgodzie najpierw `consent default` = wszystko odrzucone, potem `consent update`
  = `ad_storage`, `ad_user_data`, `ad_personalization` przyznane. `analytics_storage` zawsze odrzucone
  (nie używamy GA). Brak cichych pingów przed zgodą – najbezpieczniej prawnie (rygor ISO 27001 firmy).
- **Wszystko wyłączone bez konfiguracji** – bez `VITE_GOOGLE_ADS_ID` (np. `AW-123456789`) nie ma
  banera ani tagu. Etykiety konwersji: `VITE_GOOGLE_ADS_SIGNUP_LABEL`, `VITE_GOOGLE_ADS_PURCHASE_LABEL`
  (identyfikatory publiczne, nie sekrety; zmienne środowiskowe Vercel obu projektów).
- **Wspólna decyzja dla obu domen** – cookie `ag_consent` na domenie `.allgrafika.pl`
  (`ads=1`/`ads=0`, ważne 180 dni, `SameSite=Lax`, `Secure`). Kliknięcie reklamy trafia na landing,
  rejestracja dzieje się w aplikacji – jedna zgoda obejmuje całą ścieżkę, a cookie `_gcl_aw` Google
  zapisuje na domenie głównej, więc konwersja w aplikacji łączy się z kliknięciem.
- **Odrzucenie tak samo łatwe jak akceptacja** – dwa równorzędne przyciski „Akceptuję” i „Odrzucam”
  (wytyczne EROD 03/2022, UODO); zamknięcie banera bez wyboru = brak zgody, baner wraca przy kolejnej
  wizycie. Zgodę można zmienić w każdej chwili: link „Ustawienia cookies” w stopce i w polityce
  prywatności. Wycofanie usuwa cookies `_gcl_*` z domeny głównej.
- **Konwersje** – „Rejestracja” po udanym założeniu konta (e-mail albo Google), „Zakup” po powrocie
  z płatności z wartością w PLN (cena pakietu/abonamentu zapamiętana przed przekierowaniem do Stripe).
  Nie wysyłamy adresu e-mail ani innych danych konta (bez „enhanced conversions”).

## 4. Przepływ użytkownika (UX)

Pierwsza wizyta (brak decyzji): u dołu ekranu pasek z tekstem „Używamy plików cookies Google Ads, aby
mierzyć skuteczność naszych reklam. Włączymy je tylko za Twoją zgodą.” + link „Polityka prywatności”,
przyciski „Odrzucam” i „Akceptuję” tej samej wielkości. Na telefonie pasek nie zasłania przycisków CTA
na stałe – po decyzji znika. Baner nie jest renderowany w HTML ze statycznego prerenderu (pojawia się
po hydratacji), więc nie wpływa na SEO ani na hydratację.

## 5. Wymagania funkcjonalne

- **FR-ADS-001** – Brak tagu i banera bez `VITE_GOOGLE_ADS_ID` oraz w aplikacji natywnej.
- **FR-ADS-002** – Tag ładuje się dopiero po zgodzie, z Consent Mode v2.
- **FR-ADS-003** – Decyzja wspólna dla allgrafika.pl i app.allgrafika.pl, zmienialna w każdej chwili.
- **FR-ADS-004** – Konwersje rejestracji i zakupu tylko przy zgodzie, bez danych osobowych.

## 6. Kryteria akceptacji

- **AC-ADS-001** – Given skonfigurowany identyfikator Google Ads i brak decyzji, When pierwsza wizyta na
  stronie, Then widoczny baner z równorzędnymi przyciskami „Akceptuję” i „Odrzucam” oraz linkiem do
  polityki prywatności, a żadne żądanie do domen Google (googletagmanager.com, googleadservices.com,
  doubleclick.net) nie zostało wysłane; prerenderowany HTML nie zawiera banera.
- **AC-ADS-002** – Given baner, When „Odrzucam”, Then baner znika, zapisane `ag_consent=ads=0`, nie ma
  żadnego żądania do Google także po przeładowaniu, a baner nie wraca.
- **AC-ADS-003** – Given baner, When „Akceptuję”, Then zapisane `ag_consent=ads=1`, ładuje się
  `gtag/js?id=<ID>`, `dataLayer` zawiera `consent default` (wszystko `denied`) przed `consent update`
  (`ad_storage`, `ad_user_data`, `ad_personalization` = `granted`, `analytics_storage` = `denied`).
- **AC-ADS-004** – Given zgoda udzielona, When „Ustawienia cookies” i „Odrzucam”, Then
  `ag_consent=ads=0`, `consent update` z `denied`, cookies `_gcl_*` usunięte.
- **AC-ADS-005** – Given zgoda, When udana rejestracja albo powrót z płatności z wartością pakietu, Then
  zdarzenie `conversion` z `send_to = <ID>/<etykieta>` (zakup z `value` w PLN i `currency: PLN`); bez
  zgody, bez etykiety albo w aplikacji natywnej żadne zdarzenie nie jest wysyłane; dane zdarzenia nie
  zawierają e-maila.
- **AC-ADS-006** – Given brak `VITE_GOOGLE_ADS_ID`, When dowolna strona, Then nie ma banera ani tagu
  (dotychczasowe zachowanie).

## 7. API

Brak zmian w backendzie.

## 8. Dane i prywatność

Polityka prywatności § 3 (cel „pomiar skuteczności reklam”, podstawa: zgoda), § 4 (Google Ireland Ltd.
jako odbiorca, transfer do USA w ramach EU-U.S. Data Privacy Framework), § 5 (cookies `ag_consent`,
`_gcl_aw`, `_gcl_au`; okresy; jak wycofać zgodę). Zmiana nie pogarsza sytuacji użytkownika (wszystko
wymaga zgody), więc obowiązuje od publikacji.

## 9. Testy

AC-ADS-001..004 – Playwright na landingu (build z testowym `AW-TEST`, żądania do Google
przechwytywane, nigdy nie wychodzą do sieci) oraz testy jednostkowe modułu (vitest, aplikacja).
AC-ADS-005 i 006 – testy jednostkowe modułu (vitest). Moduł jest identyczny w obu projektach.
