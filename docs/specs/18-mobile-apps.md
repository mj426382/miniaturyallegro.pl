# 18 – Aplikacje mobilne Android i iOS

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-05 |
| Powiązane | FR-MOB-001, NFR-UX-001, spec 03, spec 06, spec 09, spec 10, spec 17 |

## 1. Kontekst

Sprzedawcy robią zdjęcia produktów telefonem. Aplikacja w App Store i Google Play ma działać 1:1 jak
aplikacja webowa (app.allgrafika.pl): te same ekrany, konto, kredyty i grafiki. Wersja webowa jest
produkcyjna i buduje SEO, dlatego żadna zmiana nie może pogorszyć działania webu ani landingu.

## 2. Decyzje

- **Capacitor** opakowuje ten sam kod React (`frontend/`). Ekrany nie są duplikowane, a każda poprawka
  webu trafia też do aplikacji.

  Pliki aplikacji są wbudowane w paczkę. Nie jest to „okno na stronę”, które Apple odrzuca
  (wytyczna 4.2). API to produkcyjne `https://server.allgrafika.pl/api`.
- **Sesja w aplikacji**:
  - WebView na iOS blokuje ciasteczka między domenami, więc aplikacja używa tokenu z odpowiedzi
    logowania i rejestracji (`Authorization: Bearer`, już obsługiwane przez API).
  - Token leży w pamięci aplikacji (Capacitor Preferences) i jest kasowany przy wylogowaniu
    i przy 401.
  - Web dalej używa ciasteczka httpOnly bez zmian.
- **Zakupy**:
  - Aplikacja nie sprzedaje kredytów. Przyciski zakupu i abonamentu otwierają
    `app.allgrafika.pl/credits` w systemowej przeglądarce, a płatność odbywa się na stronie (Stripe).
  - Kredyty kupione na stronie są od razu widoczne w aplikacji, która odświeża konto po powrocie
    na pierwszy plan.
  - Na iOS w UE link do zakupu poza App Store wymaga uprawnienia Apple „StoreKit External
    Purchase Link”. Tryb jest przełączalny w buildzie (`VITE_NATIVE_PURCHASES=web-link|hidden`), więc
    w razie odrzucenia wystarczy przebudować aplikację z `hidden`.
- **Pobieranie grafik**: zapis do pliku tymczasowego i natywny arkusz udostępniania (Filesystem
  i Share). Daje to „Zapisz obraz” w Zdjęciach na iOS i Androidzie, 1:1 z zachowaniem webu na telefonie.
- **Wymagające konfiguracji właściciela** (poza kodem):
  - Logowanie Google w aplikacji wymaga identyfikatorów OAuth dla Androida i iOS. Do tego czasu
    przycisk Google jest ukryty w aplikacji, a logowanie e-mailem działa.
  - Połączenie z Allegro otwiera stronę w przeglądarce, bo callback OAuth wraca na domenę webową.
  - Link weryfikacyjny z e-maila otwiera się w przeglądarce. Aplikacja odświeża status po powrocie.
  - Konta Apple Developer i Google Play, podpisywanie i wysyłka do sklepów.
- **Bez wpływu na web**:
  - Kod natywny ładuje się dynamicznie tylko na platformie natywnej.
  - Budżety pakietów webu (AC-PERF-003) obowiązują dalej.
- **Landing**:
  - Sekcja „Aplikacja mobilna w drodze” na stronie głównej.
  - Bez nowych adresów, bez zmian tytułu, opisu, canonical ani JSON-LD.
  - Bez oficjalnych znaków sklepów, dopóki aplikacji w nich nie ma.
- **CI**: build debug APK (Android) i build na symulator iOS (macOS runner, bez podpisu) przy każdym
  pushu. Pozwala to wykryć zepsucie projektu natywnego bez Maca.

## 3. Kryteria akceptacji

- **AC-MOB-001** – Given aplikacja uruchomiona jako natywna, When użytkownik się zaloguje lub zarejestruje, Then token z odpowiedzi jest zapisany i dołączany jako `Authorization: Bearer` do kolejnych żądań, a po wylogowaniu lub 401 znika.
- **AC-MOB-002** – Given przeglądarka (web), When działa aplikacja, Then żądania nie zawierają nagłówka `Authorization`, a sesja dalej opiera się na ciasteczku (bez zmian względem webu).
- **AC-MOB-003** – Given aplikacja natywna w trybie `web-link`, When użytkownik kliknie zakup pakietu lub abonamentu, Then otwiera się `https://app.allgrafika.pl/credits` w przeglądarce systemowej, a aplikacja nie tworzy sesji Stripe. W trybie `hidden` przyciski zakupu są niewidoczne, a stan kredytów widoczny.
- **AC-MOB-004** – Given aplikacja natywna, When użytkownik pobierze grafikę, Then plik trafia do natywnego arkusza udostępniania z nazwą i typem obrazu.
- **AC-MOB-005** – Given aplikacja natywna, When wraca na pierwszy plan, Then dane konta (kredyty, potwierdzenie e-maila) są odświeżane.
- **AC-MOB-006** – Given aplikacja natywna, When otwarty jest ekran logowania lub połączenia z Allegro, Then przycisk Google jest ukryty, a połączenie z Allegro otwiera stronę w przeglądarce.
- **AC-MOB-007** – Given API, When żądanie przychodzi z originu aplikacji (`https://native.allgrafika.pl` na Androidzie, `capacitor://native.allgrafika.pl` na iOS – host w naszej domenie, którego nie serwuje żadna strona), Then CORS je przepuszcza, a obce originy (także `https://localhost`) dalej są odrzucane.
- **AC-MOB-008** – Given strona główna landingu, When otwarta, Then widać sekcję „Aplikacja mobilna w drodze” (Android i iOS), a tytuł, canonical i JSON-LD strony głównej są takie jak wcześniej.
