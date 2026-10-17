import type { BlogPostData } from '../blogPosts'

const post: BlogPostData = {
  id: '107',
  slug: 'jaki-rozmiar-zdjecia-do-sklepu-internetowego',
  title: 'Jaki rozmiar zdjęcia do sklepu internetowego – poradnik',
  excerpt: 'Jaki rozmiar zdjęcia do sklepu internetowego wybrać? WooCommerce, Shopify, PrestaShop i Google Merchant Center: piksele, proporcje i kompresja.',
  content: `
## Własny sklep rządzi się innymi prawami niż marketplace

Na OLX czy eBay to platforma mówi Ci, jakie zdjęcia przyjmie. We własnym sklepie internetowym jest odwrotnie: to Twój motyw, ustawienia sklepu i – jeśli reklamujesz produkty w Google – Merchant Center decydują, jak duże pliki mają sens. Za małe zdjęcie rozmyje się przy powiększeniu, za duże spowolni stronę produktu.

W tym poradniku skupiamy się wyłącznie na **sklepach na własnej domenie**: WooCommerce, Shopify, PrestaShop i podobnych systemach. Limity marketplace’ów (OLX, Vinted, eBay, Amazon) zebraliśmy w osobnym artykule [Wymiary zdjęć OLX, Vinted, eBay i Amazon](https://allgrafika.pl/blog/wymiary-zdjec-olx-vinted-ebay-amazon).

## Rozmiary obrazków w WooCommerce – wartości domyślne

WooCommerce nie ma „wymaganego” rozmiaru zdjęcia. Zamiast tego z każdego wgranego pliku tworzy kilka mniejszych wersji. Według [dokumentacji WooCommerce](https://developer.woocommerce.com/docs/theming/theme-development/image-sizes/) domyślnie są to:

- **woocommerce_thumbnail** – 300 px szerokości, przycięte do kwadratu (lista produktów, kategorie),
- **woocommerce_single** – 600 px szerokości, bez przycinania (główne zdjęcie na stronie produktu),
- **woocommerce_gallery_thumbnail** – 100 x 100 px, kwadrat (miniatury pod zdjęciem głównym).

Proporcję przycinania miniatur ustawisz w Customizerze: 1:1, własną albo bez przycinania. Motyw może te wartości nadpisać, dlatego sprawdź, jak duże zdjęcie faktycznie wyświetla Twoja strona produktu, a jeśli używasz powiększenia (lupy), wgrywaj plik wyraźnie większy niż 600 px.

## Shopify – jakie pliki wgrywać

Strony pomocy Shopify nie dały się nam otworzyć bezpośrednio, więc poniższe dane podajemy za opisami tych stron w wyszukiwarce – sprawdź je przed wdrożeniem:

- według [pomocy Shopify o mediach produktowych](https://help.shopify.com/en/manual/products/product-media/product-media-types) kwadratowe zdjęcia produktów zwykle najlepiej wyglądają w rozmiarze **2048 x 2048 px**,
- według [pomocy o przesyłaniu plików](https://help.shopify.com/en/manual/shopify-admin/productivity-tools/file-uploads) zdjęcia mogą mieć do **5000 x 5000 px (25 MP)** i ważyć do **20 MB**,
- starsza strona o [obrazach w motywie](https://help.shopify.com/en/manual/online-store/images/theme-images) podaje 20 MP i 20 MB.

Shopify sam tworzy mniejsze wersje zdjęć na potrzeby motywu, więc wgrywanie dużego, kwadratowego pliku jest tu zwykle najprostszą drogą.

## PrestaShop i inne platformy – jak sprawdzić rozmiary w motywie

W PrestaShop i wielu innych systemach rozmiary obrazków definiuje motyw – w panelu znajdziesz ustawienia typów obrazków (np. dla miniatury na liście, zdjęcia na stronie produktu i powiększenia). Nie podajemy tu konkretnych liczb, bo różnią się między motywami i wersjami. Zasada jest prosta:

1. Sprawdź w ustawieniach motywu największy rozmiar, jaki jest wyświetlany (zwykle powiększenie).
2. Wgrywaj plik co najmniej tak duży, a najlepiej trochę większy.
3. Po zmianie rozmiarów w ustawieniach wygeneruj miniatury ponownie, jeśli system tego wymaga.
4. Trzymaj jedną proporcję dla wszystkich produktów w kategorii.

## Google Merchant Center – minimum dla reklam produktowych

Jeśli Twój sklep wysyła produkty do Google (Zakupy, reklamy produktowe, bezpłatne informacje o produktach), zdjęcie musi spełnić [wymagania Google Merchant Center](https://support.google.com/merchants/answer/6324350?hl=en):

- od **31 stycznia 2027** minimum **500 x 500 px** dla wszystkich produktów, zalecane około **1500 x 1500 px**,
- maksymalnie **64 megapiksele** i **16 MB** na plik,
- formaty JPEG, WebP, PNG, GIF, BMP i TIFF,
- bez dodanych tekstów promocyjnych, cen, znaków wodnych, logo, ramek i kodów QR,
- grafiki wygenerowane przez AI muszą zachować metadane oznaczające je jako AI.

To ważne dla właścicieli WooCommerce: domyślne 600 px wystarcza na stronie produktu, ale do Merchant Center Twoja wtyczka powinna wysyłać **pełny oryginał**, nie zmniejszoną wersję.

## Ile pikseli wgrać, żeby wszystko działało

Przykład podejścia, które pokrywa powyższe zalecenia: **kwadratowy plik o boku około 2000 px**. Jest większy niż zalecenie Merchant Center (ok. 1500 px), bliski zaleceniu Shopify (2048 px wg pomocy) i daje WooCommerce zapas na powiększenie. Jeśli Twój motyw używa zdjęć pionowych (np. w modzie), przyjmij jedną proporcję pionową, np. 4:5, i trzymaj się jej w całym katalogu.

Więcej pikseli nie poprawi zdjęcia, które jest nieostre lub źle oświetlone. Zacznij od dobrego zdjęcia źródłowego – pomoże Ci w tym [poradnik zdjęć produktów telefonem](https://allgrafika.pl/blog/zdjecia-produktow-telefonem-poradnik).

## Kompresja: mniejsza waga bez widocznej straty jakości

Duży plik to wolniejsza strona, szczególnie na telefonie. Kilka zasad:

- **Zmniejsz wymiary przed kompresją.** Plik 4000 x 3000 px z telefonu waży wielokrotnie więcej niż potrzebuje sklep.
- **JPG do zdjęć, PNG tylko do grafik z przezroczystością.** WebP daje zwykle mniejsze pliki przy podobnej jakości – szczegóły w artykule [JPG vs WebP vs PNG](https://allgrafika.pl/blog/jpg-vs-webp-vs-png-format-zdjec-produktowych).
- **Sprawdzaj wzrokowo.** Ustaw kompresję, porównaj z oryginałem w powiększeniu i cofnij, jeśli widzisz artefakty na krawędziach lub w gradientach.
- **Narzędzia:** Squoosh i TinyPNG w przeglądarce, wtyczki do optymalizacji obrazów w WordPressie, wbudowana optymalizacja w Shopify.

## Proporcje i spójny kadr w całym katalogu

Rozmiar w pikselach to połowa sukcesu. Druga to spójność: jeśli jedne produkty są kwadratowe, a inne poziome, siatka kategorii zaczyna „skakać”. Ustal dla sklepu:

- jedną proporcję (najczęściej 1:1),
- podobny margines wokół produktu,
- jedno tło dla zdjęć głównych (np. białe lub jasnoszare),
- tę samą wielkość produktu w kadrze.

O budowaniu jednolitego wyglądu sklepu piszemy w artykule [Spójna identyfikacja wizualna sklepu internetowego](https://allgrafika.pl/blog/spojna-identyfikacja-wizualna-sklepu-internetowego).

## Checklista przed wgraniem zdjęć do sklepu

- [ ] Znasz największy rozmiar wyświetlany przez Twój motyw (z powiększeniem)
- [ ] Plik jest od niego większy – np. kwadrat około 2000 px
- [ ] Wszystkie zdjęcia w kategorii mają tę samą proporcję
- [ ] Plik jest skompresowany i obejrzany w powiększeniu
- [ ] Nazwa pliku opisuje produkt, a pole alt jest uzupełnione
- [ ] Zdjęcie do Merchant Center nie ma napisów, logo ani ramek
- [ ] Grafika AI ma zachowane metadane AI
- [ ] Oryginał w pełnej rozdzielczości jest zachowany na dysku

## Najczęstsze pytania

### Czy WooCommerce potrzebuje zdjęć 600 x 600 px?
600 px to domyślna szerokość zdjęcia na stronie produktu, a nie wymaganie dla pliku. Wgraj większy plik – WooCommerce zrobi z niego mniejsze wersje, a Ty zachowasz zapas na powiększenie i Merchant Center.

### Czy zdjęcie 5000 px spowolni sklep?
Nie musi, jeśli platforma serwuje klientom zmniejszone wersje, tak jak robią to WooCommerce i Shopify. Spowalnia za to wgrywanie i zajmuje miejsce, dlatego około 2000 px zwykle wystarczy.

### Jak nazwać pliki zdjęć produktów?
Opisowo i bez polskich znaków, np. kubek-porcelanowy-bialy-350ml.jpg. Więcej w artykule [SEO zdjęć produktowych](https://allgrafika.pl/blog/seo-zdjec-produktowych).

### Jak szybko przygotować zdjęcia dla kilkudziesięciu produktów?
Pomaga praca seriami – opisujemy ją w artykule [Batch processing zdjęć produktowych](https://allgrafika.pl/blog/batch-processing-zdjecia-produktowe-szybko-i-latwo). W [AllGrafika.pl](https://app.allgrafika.pl/register) wgrasz do 50 zdjęć naraz, a gotowe grafiki pobierzesz jako ZIP z presetem eksportu „sklep internetowy”.

Zestaw zdjęć karty produktu i to, co o zdjęciach mówią Shopify, WooCommerce, Shoper i PrestaShop, zebraliśmy na stronie [zdjęcia produktowe do sklepu internetowego](https://allgrafika.pl/zdjecia-produktowe-do-sklepu-internetowego).

## Podsumowanie

We własnym sklepie nie ma jednego obowiązkowego rozmiaru. Sprawdź, co wyświetla Twój motyw, wgrywaj pliki większe od tego (np. kwadrat około 2000 px), trzymaj jedną proporcję w całym katalogu, kompresuj z głową i pamiętaj o zasadach Merchant Center, jeśli reklamujesz produkty w Google.

[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)
  `,
  publishedAt: '2026-10-14',
  modifiedAt: '2026-10-17',
  author: 'AllGrafika.pl',
  readTime: 7,
  category: 'Technologia',
}

export default post
