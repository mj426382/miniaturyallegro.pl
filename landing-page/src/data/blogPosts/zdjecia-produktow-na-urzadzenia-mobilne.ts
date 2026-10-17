import type { BlogPostData } from '../blogPosts'

const post: BlogPostData = {
  id: '50',
  slug: 'zdjecia-produktow-na-urzadzenia-mobilne',
  title: 'Zdjęcia produktów na urządzenia mobilne – jak je przygotować',
  excerpt: 'Jak zdjęcie produktu wygląda na ekranie telefonu w aplikacjach OLX, Vinted, eBay i w mobilnym sklepie: kadr, kontrast, proporcje, tryb ciemny i test.',
  content: `
## Telefon zmienia sposób oglądania zdjęć

Na komputerze kupujący widzi większe zdjęcia, opis obok i kilka ofert naraz. Na telefonie przewija kciukiem wąską kolumnę albo siatkę małych kafelków w aplikacji marketplace, a galerię ogląda, przesuwając zdjęcia palcem. To zmienia kilka rzeczy:

- **Kafelek na liście jest mały** – drobne detale i napisy znikają.
- **Zdjęcie bywa automatycznie przycinane** – aplikacja lub szablon sklepu dopasowuje je do własnego formatu kafelka.
- **Kupujący powiększa gestem** – rozmazane zdjęcie po powiększeniu od razu traci wiarygodność.
- **Część osób korzysta z trybu ciemnego** – zmienia się kolor otoczenia wokół Twojego zdjęcia.

Nie podajemy tu statystyk udziału ruchu mobilnego, bo różnią się między platformami i sklepami. Sprawdź je w statystykach swojego sklepu – zwykle okazuje się, że telefon jest ważniejszy, niż się wydaje.

## Kadr: produkt w bezpiecznej strefie

Ponieważ różne miejsca przycinają zdjęcie inaczej, trzymaj produkt w środku kadru z niewielkim marginesem.

- **eBay** pisze w [pomocy dotyczącej zdjęć](https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148), że proporcje 1:1 lub 16:9 „generally looks best”.
- **WooCommerce** domyślnie przycina miniaturkę produktu do kwadratu o szerokości 300 px ([dokumentacja WooCommerce](https://developer.woocommerce.com/docs/theming/theme-development/image-sizes/)); proporcje możesz zmienić w ustawieniach motywu.
- **OLX** – według starszego artykułu [pomocy OLX](https://pomoc.olx.pl/hc/pl/articles/211658765-Jak-doda%C4%87-og%C5%82oszenie-) zalecany był format 4:3; sprawdź aktualne wartości w pomocy platformy.
- **Vinted** nie podaje na oficjalnych stronach formatu ani rozdzielczości – przed publikacją zobacz, jak wygląda podgląd w aplikacji.

Najbezpieczniej: kwadratowy lub zbliżony do kwadratu kadr, produkt na środku, wokół trochę wolnego tła. Szczegółowe wymiary dla każdej platformy zebraliśmy w artykule [wymiary zdjęć na OLX, Vinted, eBay i Amazon](https://allgrafika.pl/blog/wymiary-zdjec-olx-vinted-ebay-amazon).

## Kontrast i sylwetka na małym ekranie

- **Wyraźna krawędź produktu.** Jasny produkt na jasnym tle na małym kafelku zlewa się w jedną plamę. Pomoże gradient, delikatny cień albo ciemniejsze tło na zdjęciach dodatkowych.
- **Prosta sylwetka.** Produkt pod lekkim kątem, bez rekwizytów zasłaniających kontur – rozpoznasz go nawet na miniaturce wielkości znaczka.
- **Spokojne tło.** Bogata scena lifestyle na dużym ekranie wygląda świetnie, ale na telefonie produkt może w niej zginąć. Na pierwsze zdjęcie wybierz prostszy kadr.

## Ostrość i rozdzielczość pod powiększanie

Na telefonie powiększanie jest naturalnym gestem, więc zdjęcie musi to wytrzymać:

- eBay wymaga co najmniej 500 px na dłuższym boku i zaleca około 1600 x 1600 px ([pomoc eBay](https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148)).
- Według [wytycznych Amazon dla sprzedawców](https://sellercentral.amazon.com/seller-forums/discussions/t/4b3c4c39-6f8c-4312-aa0e-99982eb8f5e1) zdjęcia powyżej 1000 px na dłuższym boku pozwalają na powiększanie.
- Zbyt mocna kompresja daje „schodki” na krawędziach i plamy w gładkich powierzchniach – widać je szczególnie na ekranach o dużej gęstości pikseli.

## Tekst na zdjęciu: na telefonie prawie zawsze przegrywa

Drobny napis na grafice na kafelku w aplikacji jest nieczytelny. Do tego na wielu platformach jest po prostu niedozwolony: [zasady eBay](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370) zabraniają dodanego tekstu i ramek, zdjęcie główne na Amazonie nie może zawierać dodatkowego tekstu, a [Google Merchant Center](https://support.google.com/merchants/answer/6324350?hl=en) nie przyjmuje tekstu promocyjnego dodanego w obróbce. Informacje o produkcie umieść w tytule i opisie – tam telefon wyświetli je czytelną czcionką.

Jeśli we własnym sklepie używasz infografik, projektuj je z myślą o telefonie: kilka krótkich haseł, duża czcionka, wysoki kontrast, jedna informacja na grafikę.

## Tryb ciemny i kolory ekranu

W trybie ciemnym zdjęcie na białym tle wygląda jak jasny prostokąt na ciemnym ekranie. To nie błąd – po prostu sprawdź, czy krawędzie zdjęcia są równe, a biel czysta, bez szarych plam. Pamiętaj też, że ekrany telefonów różnią się odwzorowaniem kolorów. Porównaj zdjęcie z produktem na dwóch różnych telefonach, zanim uznasz, że kolor jest wierny.

## Vinted: telefon to też aparat

Na Vinted zdjęcie zrobione telefonem jest w zupełności w porządku –[zasady katalogu](https://www.vinted.com/catalog-rules) wymagają właśnie własnych, nieedytowanych zdjęć, a [wskazówki Vinted](https://www.vinted.pl/help/3/377-jak-zrobic-swietne-zdjecia-wskazowki) radzą fotografować w dziennym świetle, bez lampy błyskowej i filtrów, na neutralnym tle. Nie dodawaj tam scen ani teł AI. O fotografowaniu telefonem przeczytasz więcej w poradniku [zdjęcia produktów telefonem](https://allgrafika.pl/blog/zdjecia-produktow-telefonem-poradnik).

## Jak sprawdzić zdjęcia na telefonie przed publikacją

1. **Prześlij grafikę na telefon** i obejrzyj ją pomniejszoną do rozmiaru kafelka – czy od razu wiesz, co to za produkt?
2. **Zobacz podgląd w aplikacji** platformy lub w mobilnej wersji swojego sklepu – czy nic nie zostało ucięte?
3. **Powiększ zdjęcie palcem** – czy detale są ostre?
4. **Włącz tryb ciemny** i porównaj wrażenie.
5. **Porównaj z konkurencją** na liście wyników – czy Twoje zdjęcie jest czytelne obok innych?

## Grafiki gotowe na telefon z AllGrafika.pl

W [AllGrafika.pl](https://app.allgrafika.pl/register) z jednego zdjęcia przygotujesz packshot na białym tle i grafiki w innych stylach, a przy eksporcie wybierzesz ustawienia pod OLX, Vinted, eBay, Amazon lub własny sklep – z kadrowaniem i obrotem, żeby produkt trafił w środek kadru. AI zmienia tło i światło, nie zmieniając produktu. Pierwsze 5 grafik jest bezpłatnych po potwierdzeniu adresu e-mail.

[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)
  `,
  publishedAt: '2026-05-21',
  modifiedAt: '2026-10-17',
  author: 'AllGrafika.pl',
  readTime: 7,
  category: 'E-commerce',
}

export default post
