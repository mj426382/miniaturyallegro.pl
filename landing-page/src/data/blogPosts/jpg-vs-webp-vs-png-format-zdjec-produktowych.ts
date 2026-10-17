import type { BlogPostData } from '../blogPosts'

const post: BlogPostData = {
  id: '51',
  slug: 'jpg-vs-webp-vs-png-format-zdjec-produktowych',
  title: 'JPG vs WebP vs PNG – jaki format zdjęć produktowych?',
  excerpt: 'JPG, WebP czy PNG? Porównujemy jakość, wagę plików i przezroczystość oraz sprawdzamy, które formaty przyjmują eBay, Amazon, OLX i Google Merchant Center.',
  content: `
## Format pliku to nie detal techniczny

Wybór między JPG, WebP a PNG wpływa na trzy rzeczy: jak szybko ładuje się strona z Twoim produktem, jak ostre są detale po powiększeniu i czy platforma w ogóle przyjmie plik. Zły format potrafi zrobić z lekkiego zdjęcia plik ważący kilkanaście megabajtów albo sprawić, że przezroczyste tło zamieni się na czarne.

Poniżej porównujemy trzy najpopularniejsze formaty i sprawdzamy, **które z nich oficjalnie przyjmują eBay, Amazon, OLX i Google Merchant Center**. Wszystkie dane o platformach pochodzą z ich stron pomocy.

## JPG (JPEG) – uniwersalny format do zdjęć

JPG używa kompresji stratnej: usuwa część informacji, których oko zwykle nie zauważa, dzięki czemu zdjęcia są lekkie.

- **Zalety:** małe pliki przy dobrej jakości, obsługa praktycznie wszędzie, regulowana siła kompresji.
- **Wady:** brak przezroczystości, a każde ponowne zapisanie po edycji pogarsza jakość. Przy mocnej kompresji pojawiają się artefakty – „kwadraciki” w gładkich gradientach i obwódki przy ostrych krawędziach.
- **Kiedy wybrać:** zdjęcia produktów na każdą platformę, szczególnie tam, gdzie inne formaty nie są wymienione w pomocy.

## WebP – mniejsze pliki dla Twojego sklepu

WebP to format opracowany przez Google. Obsługuje kompresję stratną i bezstratną oraz przezroczystość, a przy porównywalnej jakości daje zwykle mniejsze pliki niż JPG. Współczesne przeglądarki go obsługują, więc we własnym sklepie to dobry wybór.

- **Zalety:** mniejsza waga, przezroczystość, jeden format do zdjęć i grafik.
- **Wady:** nie każda platforma sprzedażowa wymienia go wśród akceptowanych formatów, a niektóre starsze programy graficzne nie otwierają go bez dodatków.
- **Kiedy wybrać:** zdjęcia na stronach własnego sklepu (wiele wtyczek i platform konwertuje je automatycznie) oraz eBay i Merchant Center, które oficjalnie go przyjmują.

## PNG – bezstratna jakość i przezroczystość

PNG zapisuje obraz bez strat. Świetnie nadaje się do logo, ikon, grafik z tekstem i elementów z przezroczystym tłem, ale zdjęcia w PNG są zwykle wielokrotnie cięższe niż w JPG.

- **Zalety:** brak artefaktów kompresji, ostre krawędzie tekstu, przezroczystość.
- **Wady:** duże pliki przy zdjęciach, co spowalnia stronę i może przekroczyć limit wagi na platformie.
- **Kiedy wybrać:** wycięty produkt do dalszej obróbki, grafiki z napisami do własnego sklepu, logo.

**Uwaga na przezroczystość:** zdjęcie główne z przezroczystym tłem może wyświetlić się na platformie inaczej, niż planujesz. Jeśli potrzebujesz białego tła, wypełnij je bielą przed eksportem, zamiast liczyć na to, że platforma zrobi to za Ciebie.

## Które formaty przyjmują platformy

| Platforma | JPG | PNG | WebP | Źródło |
|-----------|-----|-----|------|--------|
| eBay | tak | tak | tak | [pomoc eBay](https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148) |
| Amazon | tak (preferowany) | tak | nie wymieniono | [wpis pracownika Amazon](https://sellercentral.amazon.com/seller-forums/discussions/t/4b3c4c39-6f8c-4312-aa0e-99982eb8f5e1) |
| OLX | tak | tak | nie wymieniono | [starszy artykuł pomocy OLX](https://pomoc.olx.pl/hc/pl/articles/211658765-Jak-doda%C4%87-og%C5%82oszenie-) |
| Google Merchant Center | tak | tak | tak | [pomoc Google](https://support.google.com/merchants/answer/6324350?hl=en) |
| Vinted | brak oficjalnych danych – sprawdź w pomocy | | | |

Dodatkowo eBay przyjmuje GIF, TIFF, BMP, HEIC i AVIF, a Amazon według wytycznych dla sprzedawców także TIFF i GIF bez animacji. Dane OLX pochodzą ze starszego artykułu, więc sprawdź aktualną listę w formularzu ogłoszenia.

## A co z HEIC i AVIF?

**HEIC** to domyślny format zdjęć w iPhone’ach. Jest lekki, ale nie wszędzie obsługiwany – eBay go przyjmuje, natomiast pomoc OLX i wytyczne Amazon go nie wymieniają. Najprościej ustawić w telefonie zapis w formacie „najbardziej zgodnym” (JPG) albo konwertować pliki przed wysyłką.

**AVIF** daje jeszcze mniejsze pliki niż WebP i jest przyjmowany przez eBay. Na innych platformach z naszej listy nie jest wymieniony, więc na razie traktuj go jako format do własnej strony, a nie do ogłoszeń.

## Ten sam produkt, trzy formaty – przykład hipotetyczny

Przykład hipotetyczny: masz zdjęcie kubka na białym tle, kwadrat 1600 px.

- Zapisane jako **PNG** – plik jest duży, bo bezstratnie zapisuje każdy piksel zdjęcia.
- Zapisane jako **JPG** z umiarkowaną kompresją – kilkukrotnie lżejsze, a różnicy nie widać bez powiększenia.
- Zapisane jako **WebP** – zwykle jeszcze lżejsze niż JPG przy podobnym wyglądzie.

Dokładne wagi zależą od zdjęcia, dlatego zrób ten test na własnym pliku. Na eBay i w sklepie wybierz najlżejszą wersję, która wygląda dobrze, a na Amazon i OLX – JPG.

## Praktyczne zasady eksportu

1. **Pracuj na oryginale.** Edytuj zawsze pełny plik źródłowy, a JPG/WebP eksportuj na końcu – unikniesz wielokrotnej kompresji.
2. **Najpierw wymiary, potem kompresja.** Zmniejsz zdjęcie do potrzebnego rozmiaru, zanim ustawisz jakość.
3. **Obejrzyj wynik w powiększeniu.** Szukaj artefaktów przy krawędziach produktu i w gładkim tle.
4. **Zachowaj profil kolorów sRGB.** Zdjęcie w innym profilu może wyglądać w przeglądarce bardziej blado.
5. **Nie usuwaj metadanych AI**, jeśli wysyłasz grafiki wygenerowane przez AI do Merchant Center – Google tego wymaga.

Limity rozdzielczości i wagi plików na poszczególnych platformach opisujemy w artykule [Wymiary zdjęć OLX, Vinted, eBay i Amazon](https://allgrafika.pl/blog/wymiary-zdjec-olx-vinted-ebay-amazon), a rozmiary do sklepu w poradniku [Jaki rozmiar zdjęcia do sklepu internetowego](https://allgrafika.pl/blog/jaki-rozmiar-zdjecia-do-sklepu-internetowego).

## Najczęstsze pytania

### Czy format pliku wpływa na sprzedaż?
Bezpośrednio nie – kupujący nie widzi rozszerzenia pliku. Pośrednio tak: zbyt mocna kompresja psuje detale, a zbyt ciężkie pliki spowalniają stronę sklepu.

### Czy mogę wgrać PNG na OLX albo Amazon?
Tak, oba formaty są wymienione w ich pomocy. Przy zdjęciach JPG da jednak mniejszy plik, więc łatwiej zmieścisz się w limicie wagi.

### Jaki format wybrać do własnego sklepu?
WebP lub JPG do zdjęć, PNG do grafik z tekstem i przezroczystością. Wiele platform sklepowych samo serwuje WebP klientom, więc możesz wgrywać JPG.

## Jak to wygląda w AllGrafika.pl

W [AllGrafika.pl](https://app.allgrafika.pl/register) wybierasz preset eksportu dla OLX, Vinted, eBay, Amazon lub ogólnego sklepu internetowego, a gotowe pliki pobierasz pojedynczo albo jako ZIP. Jeśli porównujesz style zdjęć, a nie formaty, zajrzyj do artykułu [Najlepsze style zdjęć produktowych](https://allgrafika.pl/blog/najlepsze-style-zdjec-produktowych).

[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)
  `,
  publishedAt: '2026-05-22',
  modifiedAt: '2026-10-17',
  author: 'AllGrafika.pl',
  readTime: 6,
  category: 'Technologia',
}

export default post
