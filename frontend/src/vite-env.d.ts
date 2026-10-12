/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** Spec 21: Google Ads (public ids, not secrets). */
  readonly VITE_GOOGLE_ADS_ID?: string
  readonly VITE_GOOGLE_ADS_SIGNUP_LABEL?: string
  readonly VITE_GOOGLE_ADS_PURCHASE_LABEL?: string
  /** Spec 22: GA4 measurement id override (default G-C3NE5EW4ED; "off" disables GA4). */
  readonly VITE_GA4_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
