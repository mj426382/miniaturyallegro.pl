/** Copy and sources shared by several landing pages (src/data/seoContent/*.ts). */
import { FREE_GRAPHICS, packages, perCredit, plans } from './pricing'
import type { SeoSource } from './seoContentLoader'

const cheapest = packages.reduce((a, b) => (a.price / a.credits < b.price / b.credits ? a : b))
const smallest = packages[0]
const cheapestPlan = plans.reduce((a, b) => (a.price / a.credits < b.price / b.credits ? a : b))

export const PRICE_FAQ = {
  q: 'Ile kosztuje jedna grafika?',
  a: `Pierwsze ${FREE_GRAPHICS} grafik jest darmowych po potwierdzeniu adresu e-mail, bez podawania karty. Potem 1 kredyt = 1 grafika: od ${perCredit(smallest.price, smallest.credits)} w pakiecie ${smallest.credits} kredytów do ${perCredit(cheapest.price, cheapest.credits)} w pakiecie ${cheapest.credits} kredytów, a w abonamencie od ${perCredit(cheapestPlan.price, cheapestPlan.credits)}. Opis oferty, eksport, infografiki i paczki ZIP nie kosztują dodatkowych kredytów.`,
}

export const NO_INTEGRATION_FAQ = {
  q: 'Czy AllGrafika sama publikuje zdjęcia na platformie?',
  a: 'Nie. AllGrafika nie łączy się z kontami na platformach sprzedażowych ani w sklepach i nie prosi o żadne hasła. Pobierasz gotowe pliki (pojedynczo albo w paczce ZIP) i kopiujesz opis, a ofertę lub produkt dodajesz samodzielnie.',
}

/** Official sources quoted on the landing pages (checked 2026-10-17). */
export const SRC = {
  amazon: { label: 'Amazon Seller Central – wymagania dotyczące zdjęć produktów (G1881)', url: 'https://sellercentral.amazon.com/help/hub/reference/external/G1881' },
  ebayPolicy: { label: 'eBay – zasady dotyczące zdjęć (Picture policy)', url: 'https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370' },
  ebayAdding: { label: 'eBay – dodawanie zdjęć do ofert', url: 'https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148' },
  vintedRules: { label: 'Vinted – zasady katalogu', url: 'https://www.vinted.com/catalog-rules' },
  vintedHelp: { label: 'Vinted – pomoc: jak robić dobre zdjęcia', url: 'https://www.vinted.co.uk/help/48' },
  olx: { label: 'Pomoc OLX – jak dodać ogłoszenie', url: 'https://pomoc.olx.pl/hc/pl/articles/211658765' },
  merchant: { label: 'Google Merchant Center – wymagania dotyczące zdjęć produktów', url: 'https://support.google.com/merchants/answer/6324350' },
  shopify: { label: 'Shopify Help Center – typy mediów produktowych', url: 'https://help.shopify.com/en/manual/products/product-media/product-media-types' },
  woocommerce: { label: 'WooCommerce – rozmiary obrazów (dokumentacja deweloperska)', url: 'https://developer.woocommerce.com/docs/theming/theme-development/image-sizes/' },
  shoper: { label: 'Shoper Learn – jak zmienić rozmiar zdjęć w galerii produktu', url: 'https://www.shoper.pl/learn/artykul/zdjecia-rozmiar-galeria-produktu' },
  prestashop: {
    label: 'PrestaShop 9 – dokumentacja: ustawienia obrazów',
    url: 'https://docs.prestashop-project.org/v.9-documentation/user-guide/improving-shop/customizing-store-design/image-settings',
  },
  kbPackshot: { label: 'KB.pl – cennik fotografii produktowej (packshot) 2026', url: 'https://kb.pl/cenniki/fotografia-podatkowa-packshot/' },
} satisfies Record<string, SeoSource>
