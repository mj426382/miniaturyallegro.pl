# Aplikacje mobilne: build i publikacja

Aplikacje na Androida i iOS to ta sama aplikacja React (`frontend/`), spakowana przez Capacitor
(spec 18). Każda zmiana w webie trafia do aplikacji przy następnym buildzie natywnym.

## Codzienna praca

```bash
cd frontend
npm run cap:sync      # build z .env.native (API produkcyjne) + kopiowanie do android/ i ios/
npm run cap:android   # otwiera Android Studio
npm run cap:ios       # otwiera Xcode (tylko macOS)
```

CI przy każdym pushu buduje debug APK (artefakt `allgrafika-android-debug`) i wersję iOS na symulator.
APK z artefaktu można zainstalować na telefonie z Androidem do testów: włącz „Instalowanie z nieznanych
źródeł”.

## Kroki właściciela przed publikacją

1. **Konta deweloperskie**
   - Google Play Console: 25 USD jednorazowo.
   - Apple Developer Program: 99 USD rocznie, konto firmowe z numerem D-U-N-S.
2. **Identyfikator aplikacji**: `pl.allgrafika.app`. Zarezerwuj go w obu konsolach.
3. **Ikona**: zamień `frontend/assets/icon-only.png` na wersję 1024×1024 px, bo obecna jest
   powiększona z logo 500 px. Potem uruchom `npx @capacitor/assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'`.
   Usuń wygenerowane przy okazji `frontend/icons/` i `frontend/public/manifest.webmanifest`, bo web ich nie używa.
4. **Podpisywanie**
   - Android: wygeneruj w Android Studio klucz uploadu (Build → Generate Signed Bundle).
   - iOS: certyfikat dystrybucyjny i profil w Xcode (Signing & Capabilities → Team).
   - Klucze i hasła trzymaj poza repozytorium.
5. **Build wydania**
   - Android: `Build → Generate Signed Bundle (.aab)` → Play Console, najpierw ścieżka testów wewnętrznych.
   - iOS: `Product → Archive` → App Store Connect → TestFlight.
   - Bez Maca: buildy w chmurze, np. Codemagic albo Ionic Appflow. Projekt `frontend/ios` jest gotowy.
6. **Karty w sklepach**:
   - opis, zrzuty ekranu (telefon i tablet),
   - link do polityki prywatności `https://allgrafika.pl/polityka-prywatnosci`,
   - kontakt `kontakt@allgrafika.pl`,
   - formularz „Data safety” (Google) i „App Privacy” (Apple): e-mail, zdjęcia przesyłane do generowania, brak śledzenia.
7. **Konto testowe dla recenzentów**: oba sklepy wymagają loginu i hasła. Załóż osobne konto z kilkoma
   kredytami i podaj je tylko w formularzu sklepu, nigdy w repozytorium.

## Zakupy (ważne przy recenzji Apple)

Aplikacja nie sprzedaje kredytów. Przyciski zakupu otwierają `app.allgrafika.pl/credits` w przeglądarce
(`VITE_NATIVE_PURCHASES=web-link` w `frontend/.env.native`).

Apple w UE dopuszcza taki link tylko z uprawnieniem „StoreKit External Purchase Link Entitlement”
(wniosek w App Store Connect, Apple pobiera prowizję). Jeśli recenzja odrzuci aplikację, ustaw
`VITE_NATIVE_PURCHASES=hidden` i zbuduj ponownie. Przyciski zakupu znikną, a kredyty kupione na stronie
dalej będą działać w aplikacji.

## Do zrobienia później

- **Logowanie Google w aplikacji**: wymaga identyfikatorów OAuth dla Androida (SHA-1 klucza)
  i iOS w Google Cloud oraz natywnej wtyczki. Do tego czasu przycisk jest ukryty.
- **Linki z e-maili otwierane w aplikacji** (App Links / Universal Links): wymaga plików
  `assetlinks.json` i `apple-app-site-association` na app.allgrafika.pl.
- Nie twórz rekordu DNS dla `native.allgrafika.pl`. To wewnętrzna nazwa originu aplikacji,
  której API ufa w CORS (spec 18, AC-MOB-007).
