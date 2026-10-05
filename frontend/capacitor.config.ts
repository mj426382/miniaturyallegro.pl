import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Spec 18: Android and iOS apps built from this same React app.
 * Web assets are bundled into the app (`npm run build:native` → dist-native), not loaded from
 * app.allgrafika.pl; the app talks to the production API (see .env.native).
 */
const config: CapacitorConfig = {
  appId: 'pl.allgrafika.app',
  appName: 'AllGrafika',
  webDir: 'dist-native',
  server: {
    // The app's origin is https://native.allgrafika.pl (Android) / capacitor://native.allgrafika.pl (iOS):
    // a host on our own domain that no website can serve, so the API can trust it in CORS (AC-MOB-007).
    // Nothing is fetched from it – Capacitor serves the bundled files under this name.
    androidScheme: 'https',
    hostname: 'native.allgrafika.pl',
  },
  ios: {
    // Keeps content clear of the notch and the home indicator.
    contentInset: 'always',
  },
}

export default config
