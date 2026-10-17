import type { BlogPostData } from '../blogPosts'

const post: BlogPostData = {
  id: '63',
  slug: 'porownanie-platform-e-commerce-wymagania-graficzne',
  title: 'Marketplace czy własny sklep – wymagania graficzne',
  excerpt: 'Amazon i eBay narzucają zasady zdjęć, a w Shopify i WooCommerce ustalasz je sam. Porównujemy wymagania graficzne i to, czego potrzebuje każdy kanał.',
  content: `
## Kto ustala zasady: platforma czy Ty

Sprzedaż na marketplace i we własnym sklepie wymaga tych samych produktów, ale zupełnie innego podejścia do grafiki. Na Amazonie czy eBay zasady zdjęć są narzucone z góry i egzekwowane przez moderację. W Shopify czy WooCommerce nikt Ci niczego nie zablokuje – ale też nikt nie zadba za Ciebie o to, żeby katalog wyglądał spójnie.

Ten artykuł nie powtarza tabel z pikselami. Konkretne limity plików znajdziesz w poradnikach [Wymiary zdjęć OLX, Vinted, eBay i Amazon](https://allgrafika.pl/blog/wymiary-zdjec-olx-vinted-ebay-amazon) oraz [Jaki rozmiar zdjęcia do sklepu internetowego](https://allgrafika.pl/blog/jaki-rozmiar-zdjecia-do-sklepu-internetowego). Tutaj porównujemy, **czego każdy z czterech kanałów oczekuje od Twoich grafik** i jak przygotować jeden zestaw zdjęć, który obsłuży je wszystkie.

## Amazon – katalog, w którym wszyscy wyglądają podobnie

Amazon traktuje zdjęcie główne jak element katalogu, a nie reklamę. Według wytycznych Amazon dla sprzedawców, opublikowanych przez pracownika na [forum Seller Central](https://sellercentral.amazon.com/seller-forums/discussions/t/13af96ea-6b07-4bf9-8dbe-a13292c2e3b1), zdjęcie główne ma mieć czysto białe tło (RGB 255, 255, 255), produkt na co najmniej 85% kadru i żadnego dodanego tekstu, grafik ani znaków wodnych.

Co z tego wynika dla Ciebie:

- **wyróżniasz się jakością, a nie stylem** – ostrość, światło i dobrze wykadrowany produkt,
- **kreatywność przenosisz do galerii** – zdjęcia w użyciu, detale, porównanie wielkości,
- **potrzebujesz packshotu** na każdy produkt i wariant.

## eBay – zdjęcie ma dokumentować konkretną rzecz

eBay nie wymaga białego tła, ale jego [polityka zdjęć](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370) zabrania ramek, dodanego tekstu, materiałów marketingowych i znaków wodnych na wszystkich zdjęciach. Przy przedmiotach używanych, uszkodzonych lub wadliwych nie wolno używać zdjęć stockowych – trzeba pokazać tę konkretną sztukę.

Co z tego wynika:

- **czyste zdjęcia bez dodatków** – żadnych plakietek, infografik i logo,
- **dużo ujęć** – eBay pozwala na wiele zdjęć w ofercie, więc pokaż produkt z każdej strony,
- **przy rzeczach używanych prawdziwe zdjęcia stanu**, nie ładne wizualizacje.

## Shopify – motyw decyduje o kadrze

W Shopify to Ty decydujesz, czy zdjęcia mają białe tło, aranżacje czy ciemne, luksusowe tło. Platforma nie moderuje stylu, a o tym, jak zdjęcia się wyświetlają, decyduje motyw: jedne przycinają do kwadratu, inne do pionu, jeszcze inne pokazują oryginalną proporcję. Według pomocy Shopify kwadratowe zdjęcia produktów zwykle najlepiej wyglądają w rozmiarze 2048 x 2048 px – szczegóły i źródła w poradniku o rozmiarze zdjęć do sklepu.

Co z tego wynika:

- **musisz sam ustalić standard** – proporcję, tło, margines, kąt ujęcia,
- **możesz budować markę obrazem** – spójny styl zdjęć to część identyfikacji sklepu,
- **zdjęcia lifestyle i infografiki są dozwolone na stronie produktu**, o ile nie wprowadzają w błąd.

## WooCommerce – ustawienia w Customizerze i motywie

WooCommerce działa podobnie jak Shopify, ale daje więcej ustawień technicznych. Według [dokumentacji WooCommerce](https://developer.woocommerce.com/docs/theming/theme-development/image-sizes/) sklep tworzy z każdego pliku miniaturę listy (domyślnie kwadrat 300 px), zdjęcie strony produktu (600 px szerokości) i małe miniatury galerii, a proporcję przycinania ustawisz w Customizerze.

Co z tego wynika:

- **ustal proporcję przed dodaniem katalogu** – zmiana później oznacza ponowne generowanie miniatur i często poprawki kadrów,
- **wgrywaj większe pliki niż domyślne rozmiary**, żeby działało powiększenie,
- **zadbaj o optymalizację** – na WordPressie wolne zdjęcia to częsty powód wolnej strony.

## Co się zmienia, gdy reklamujesz własny sklep w Google

Swoboda własnego sklepu kończy się w momencie, gdy wysyłasz produkty do Google. [Google Merchant Center](https://support.google.com/merchants/answer/6324350?hl=en) zabrania na zdjęciach dodanych tekstów promocyjnych, cen, znaków wodnych, logo, ramek i kodów QR, a grafiki AI muszą mieć zachowane metadane AI. W praktyce Twój sklep potrzebuje wtedy dwóch rodzajów zdjęć: **czystego zdjęcia głównego** dla Google i **dowolnych zdjęć dodatkowych** na stronie produktu.

## Porównanie w pigułce

| Co porównujemy | Amazon | eBay | Shopify | WooCommerce |
|----------------|--------|------|---------|-------------|
| Kto ustala styl zdjęcia głównego | platforma | platforma (zakazy) | Ty i motyw | Ty i motyw |
| Białe tło | wymagane na zdjęciu głównym | nie jest wymagane | Twoja decyzja | Twoja decyzja |
| Napisy, plakietki, ramki | zakazane na zdjęciu głównym | zakazane na wszystkich zdjęciach | dozwolone (poza feedem Google) | dozwolone (poza feedem Google) |
| Najważniejsza praca | packshot każdego wariantu | prawdziwe zdjęcia sztuki | spójny styl katalogu | spójny kadr i optymalizacja |

## Jeden zestaw zdjęć dla wielu kanałów – plan pracy

Jeśli sprzedajesz jednocześnie na marketplace i we własnym sklepie, nie rób osobnych sesji dla każdego kanału. Przygotuj jeden zestaw i eksportuj z niego wersje:

1. **Packshot na białym tle** – zdjęcie główne na Amazon, zdjęcie do Merchant Center, a w sklepie zdjęcie na listę produktów.
2. **2–3 ujęcia z detalami** – działają wszędzie, także na eBay.
3. **Zdjęcie w scenie lub w użyciu** – galeria na Amazonie i strona produktu w sklepie.
4. **Grafika z opisem cech lub plakietką** – tylko we własnym sklepie i w mediach społecznościowych, nigdy jako zdjęcie główne na marketplace i nigdy na eBay.

Przykład hipotetyczny: sprzedajesz zegarki. Na Amazonie zdjęciem głównym jest zegarek na czystej bieli, a w galerii zegarek na nadgarstku. Na eBay pokazujesz te same zdjęcia bez żadnych dodatków. W sklepie na Shopify możesz użyć ciemnego, eleganckiego tła na stronie kategorii, jeśli tak wygląda cały katalog, i infografiki z wymiarami koperty na stronie produktu.

## Gdzie pomaga AllGrafika.pl

Z jednego zdjęcia z telefonu w [AllGrafika.pl](https://app.allgrafika.pl/register) zrobisz packshot na białym tle, aranżację we wnętrzu, ujęcie w użyciu czy kolaż kilku ujęć, a przy pobieraniu wybierzesz preset eksportu pod Amazon, eBay albo ogólny sklep internetowy. AI zmienia tło, scenę i światło, ale nie kształt, kolory, logo ani napisy produktu. Pliki pobierasz na dysk i sam wgrywasz je na platformę lub do sklepu – aplikacja nie łączy się z kontami sprzedażowymi. Przegląd stylów znajdziesz w artykule [Najlepsze style zdjęć produktowych](https://allgrafika.pl/blog/najlepsze-style-zdjec-produktowych).

## Najczęstsze pytania

### Który kanał jest najbardziej wymagający graficznie?
Pod względem zasad – Amazon na zdjęciu głównym i eBay na wszystkich zdjęciach. Pod względem pracy – własny sklep, bo spójność katalogu zależy wyłącznie od Ciebie.

### Czy mogę użyć w sklepie tych samych zdjęć co na Amazonie?
Tak, packshot na białym tle świetnie sprawdza się też na liście produktów w sklepie. Upewnij się tylko, że masz do nich pełne prawa i oryginały w dużej rozdzielczości.

### Czy infografiki są gdziekolwiek dozwolone?
We własnym sklepie tak, na stronie produktu. Na eBay dodany tekst jest zakazany, na Amazonie nie może być go na zdjęciu głównym, a w feedzie do Google nie powinien się znaleźć.

[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)
  `,
  publishedAt: '2026-06-03',
  modifiedAt: '2026-10-17',
  author: 'AllGrafika.pl',
  readTime: 7,
  category: 'E-commerce',
}

export default post
