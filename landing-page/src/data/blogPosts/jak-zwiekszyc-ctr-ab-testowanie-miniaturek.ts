import type { BlogPostData } from '../blogPosts'

const post: BlogPostData = {
  id: '13',
  slug: 'jak-zwiekszyc-ctr-ab-testowanie-miniaturek',
  title: 'Testy A/B zdjęć produktowych – jak zwiększyć CTR',
  excerpt: 'Testy A/B zdjęć produktowych we własnym sklepie i porównania przed/po na marketplace: co zmieniać, jak długo testować i jak czytać wynik.',
  content: `
## Dlaczego warto testować zdjęcia, a nie zgadywać?

CTR (click-through rate) to odsetek osób, które zobaczyły produkt na liście – w kategorii sklepu, w wynikach wyszukiwania czy na marketplace – i w niego kliknęły. Zdjęcie jest tam najbardziej widocznym elementem obok nazwy i ceny. Jeśli nie zatrzymuje wzroku, nawet dobra oferta nie dostaje szansy.

Intuicja sprzedawcy często się myli: zdjęcie, które nam się podoba, nie musi przekonywać kupujących. Dlatego zamiast zgadywać, lepiej porównać dwie wersje na prawdziwym ruchu. Ten poradnik pokazuje, jak zrobić to w dwóch sytuacjach: **we własnym sklepie**, gdzie możliwy jest prawdziwy test A/B, i **na marketplace**, gdzie zwykle zostaje porównanie przed i po.

## Co w zdjęciu wpływa na kliknięcia

Zanim zaczniesz testować, wybierz element, który ma realną szansę coś zmienić:

- **Kontrast produktu z tłem** – produkt musi wyraźnie odcinać się od tła. Białe i srebrne przedmioty na białym tle potrzebują delikatnego cienia.
- **Wielkość produktu w kadrze** – na liście produktów zdjęcie jest małe. Produkt powinien wypełniać kadr, a nie stać pośrodku pustej przestrzeni.
- **Kąt ujęcia** – na wprost, pod kątem, z góry. Dla niektórych produktów ujęcie pod kątem lepiej pokazuje bryłę.
- **Prostota** – jeden produkt, jeden punkt uwagi.
- **Rodzaj tła na zdjęciach dodatkowych** – scena lifestyle, ciemne tło, gradient. Zdjęcie główne zostaw tam, gdzie zasady platformy tego wymagają, na białym tle.

O doborze stylu do kategorii piszemy w poradniku [zdjęcia produktowe dla kategorii](https://allgrafika.pl/blog/zdjecia-produktowe-dla-kategorii-poradnik), a o kolorach – w artykule [psychologia kolorów w zdjęciach produktowych](https://allgrafika.pl/blog/psychologia-kolorow-w-zdjeciach-produktowych).

## Test A/B we własnym sklepie

We własnym sklepie internetowym możesz przeprowadzić klasyczny test: część odwiedzających widzi wersję A, część wersję B, w tym samym czasie. To najrzetelniejsza metoda, bo obie wersje mają te same warunki – ten sam dzień tygodnia, te same promocje, tę samą pogodę.

Jak to zorganizować:

- **Narzędzie** – wiele platform sklepowych (Shopify, WooCommerce, PrestaShop) ma aplikacje lub wtyczki do testów A/B. Sprawdź, czy wybrane rozwiązanie pozwala testować zdjęcia produktu, a nie tylko nagłówki i przyciski.
- **Jedna zmiana** – wersje różnią się tylko jednym elementem, np. tłem zdjęcia głównego.
- **Losowy podział** – narzędzie powinno samo przypisywać odwiedzających do wersji i pokazywać każdemu tę samą wersję przy kolejnych wizytach.
- **Cel ustalony z góry** – kliknięcia w produkt z listy kategorii, dodania do koszyka albo zamówienia. Wybierz jeden główny wskaźnik przed startem.
- **Czas** – co najmniej pełny tydzień, żeby objąć dni robocze i weekend. Przy małym ruchu dłużej.

Nie kończ testu w momencie, gdy jedna wersja chwilowo prowadzi. Wyniki na początku testu skaczą i łatwo o fałszywy wniosek.

## Porównanie przed i po na marketplace

Na marketplace’ach takich jak OLX, eBay czy Amazon zwykle nie ustawisz losowego podziału ruchu dla zdjęć. Zostaje porównanie w czasie:

1. **Wybierz ofertę z regularnym ruchem** – przy kilku wyświetleniach dziennie wynik będzie przypadkowy.
2. **Zapisz stan wyjściowy** – wyświetlenia, wejścia, sprzedaż z ostatnich 1–2 tygodni, tyle, ile pokazuje panel sprzedawcy.
3. **Zmień tylko zdjęcie** – bez zmiany ceny, tytułu i promowania w tym czasie.
4. **Odczekaj tyle samo** – i porównaj te same liczby.
5. **Uważaj na kalendarz** – święta, wyprzedaże i początek miesiąca same zmieniają ruch.

Pamiętaj o zasadach platformy: na Vinted zdjęcia muszą być zrobione przez Ciebie i pokazywać przedmiot bez edycji ([zasady katalogu Vinted](https://www.vinted.com/catalog-rules)), a na eBay nie wolno dodawać do zdjęć tekstu ani ramek ([zasady zdjęć eBay](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370)). Testuj warianty, które mieszczą się w tych regułach – np. inne ujęcie, inne światło, inne kadrowanie.

## Jakie warianty porównywać

Dobre pary do testu różnią się wyraźnie, ale tylko jedną rzeczą:

- białe tło kontra jasny gradient (zdjęcie w galerii lub w sklepie),
- produkt na wprost kontra pod kątem,
- produkt wypełniający kadr kontra więcej przestrzeni wokół,
- scena lifestyle kontra zdjęcie w użyciu jako drugie zdjęcie galerii.

Zbyt subtelna różnica (odcień tła o kilka tonów) rzadko daje mierzalny efekt przy typowym ruchu.

## Jak czytać wynik

- **Wyraźna różnica w kliknięciach i zamówieniach** – zostaw lepszą wersję i sprawdź ten sam wzór na podobnych produktach.
- **Więcej kliknięć, ale nie więcej zamówień** – zdjęcie przyciąga, ale strona produktu nie przekonuje. Sprawdź cenę, opis i galerię.
- **Brak różnicy** – zmiana była za mała albo ruch za niski. To też wynik: możesz zostać przy tańszej w przygotowaniu wersji.

Nie przenoś wyniku jednego testu na cały sklep bez sprawdzenia. To, co działa przy butach, nie musi działać przy elektronice. Więcej o wskaźnikach poza CTR przeczytasz w artykule [metryki sprzedaży – co mierzyć poza CTR](https://allgrafika.pl/blog/metryki-sprzedazy-co-mierzyc-poza-ctr).

## Skąd wziąć warianty do testów

Najwięcej pracy wymaga przygotowanie kilku wersji zdjęcia. W [AllGrafika.pl](https://app.allgrafika.pl/register) z jednego zdjęcia produktu wygenerujesz warianty w różnych stylach (np. białe tło, lifestyle, ciemny luksus, gradient). Produkt pozostaje taki jak na Twoim zdjęciu – zmienia się tło, scena i oświetlenie. Pierwsze 5 grafik jest bezpłatnych po potwierdzeniu adresu e-mail.

Jeśli masz bardzo mały ruch albo budżet, zobacz też [jak testować zdjęcia produktów bez dużego budżetu](https://allgrafika.pl/blog/jak-testowac-miniaturki-bez-duzego-budzetu).

## Podsumowanie

Wyższy CTR zaczyna się od czytelnego zdjęcia, ale potwierdzisz to tylko danymi. We własnym sklepie zrób prawdziwy test A/B z losowym podziałem ruchu, na marketplace porównuj okresy przed i po zmianie. W obu przypadkach zmieniaj jedną rzecz naraz i patrz nie tylko na kliknięcia, ale też na zamówienia.

[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)
  `,
  publishedAt: '2026-04-14',
  modifiedAt: '2026-10-17',
  readTime: 7,
  category: 'E-commerce',
}

export default post
