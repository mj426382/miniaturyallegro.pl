/**
 * Spec 25: plain-language tips for one analysed photo. Text may contain [label](/path) links (RichText).
 * Platform facts quoted here come from the requirement table (requirements.ts) – no other numbers.
 */
import { FORMAT_LABEL, MB, type ImageAnalysis } from './analyze'
import { heicSupport, type PlatformResult } from './requirements'

/** Polish plural: plural(2, 'zdjęcie', 'zdjęcia', 'zdjęć') → "2 zdjęcia". */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  const word = n === 1 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many
  return `${n} ${word}`
}

export function tipsFor(a: ImageAnalysis, results: PlatformResult[]): string[] {
  if (a.error) return ['Otwórz zdjęcie w galerii telefonu lub programie graficznym i zapisz je ponownie jako JPEG albo PNG, a potem sprawdź jeszcze raz.']
  const tips: string[] = []
  const formatFails = results.filter((r) => r.checks.some((c) => c.requirement.rule.kind === 'formats' && c.status !== 'pass'))
  if (a.format === 'heic') {
    const { rejected, accepted } = heicSupport()
    tips.push(
      `HEIC to format zdjęć z iPhone’a. Według dokumentacji nie przyjmują go: ${rejected.join(', ')}; przyjmują: ${accepted.join(', ')}. Zapisz zdjęcie jako JPEG – w iPhonie ustawisz to w Ustawienia → Aparat → Formaty → „Najbardziej zgodne”.`,
    )
  } else if (formatFails.length) {
    tips.push(
      `Format ${FORMAT_LABEL[a.format]} nie jest na liście ${formatFails.map((r) => r.platform.name).join(', ')}. Zapisz zdjęcie jako JPEG lub PNG – oba formaty są na liście każdej platformy z tabeli, która publikuje formaty.`,
    )
  }
  const long = Math.max(a.width ?? 0, a.height ?? 0)
  if (long < 1000) {
    tips.push(
      'Zdjęcie jest małe. Zrób je aparatem w pełnej rozdzielczości – zrzut ekranu albo zdjęcie przesłane komunikatorem bywa zmniejszone. Więcej w poradniku [zdjęcia produktów telefonem](/blog/zdjecia-produktow-telefonem-poradnik).',
    )
  }
  if (a.bytes > 5 * MB) tips.push('Plik jest duży (OLX przy eksporcie przez API przyjmuje do 5 MB). Zmniejsz wymiary albo zapisz JPEG w niższej jakości.')
  if ((a.megapixels ?? 0) > 25 || long > 5000) tips.push('Shopify przyjmuje zdjęcia do 5000 × 5000 px i 25 MP – zmniejsz zdjęcie przed wgraniem do sklepu.')
  const verdict = a.pixels?.border.verdict
  if (verdict === 'transparent' || (a.pixels?.transparentShare ?? 0) > 0) {
    tips.push('Zdjęcie ma przezroczyste tło. Amazon wymaga na zdjęciu głównym czystej bieli – wypełnij tło białym kolorem albo zrób [zdjęcie produktu na białym tle](/biale-tlo-zdjecie-produktu).')
  } else if (verdict === 'light' || verdict === 'not-white') {
    tips.push('Tło przy krawędziach nie jest czystą bielą, której Amazon wymaga na zdjęciu głównym. Zobacz, jak zrobić [zdjęcie produktu na białym tle](/biale-tlo-zdjecie-produktu) bez studia.')
  }
  if (a.ratio && !(a.ratio.common?.[0] === 1 && a.ratio.common?.[1] === 1)) {
    tips.push('Proporcję 1:1 wymienia eBay (obok 16:9), Shopify zaleca kwadrat 2048 px, a WooCommerce domyślnie przycina miniatury do kwadratu. Przytnij zdjęcie, zostawiając margines wokół produktu.')
  }
  if (a.rotatedByMetadata) tips.push('Zdjęcie jest obrócone tylko w metadanych (EXIF). Wymiary podajemy po obrocie; jeśli platforma pokaże je bokiem, obróć je i zapisz ponownie.')
  tips.push('Narzędzie nie sprawdza treści zdjęcia (napisy, ramki, znaki wodne, wypełnienie kadru) – te zasady znajdziesz w tabeli wymagań poniżej.')
  return tips
}
