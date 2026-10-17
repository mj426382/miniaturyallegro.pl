import type { BlogPostData } from '../blogPosts'

const post: BlogPostData = {
  id: '21',
  slug: 'seo-zdjec-produktowych',
  title: 'SEO zdjęć produktowych – nazwy plików, alt i Google',
  excerpt: 'SEO zdjęć produktowych w praktyce: nazwy plików, tekst alt, Google Grafika, Merchant Center i szybkość strony, a do tego jakość zdjęcia na marketplace.',
  content: `
## Gdzie SEO zdjęć naprawdę ma znaczenie

O SEO zdjęć mówi się zwykle tak, jakby wszędzie działało tak samo. Tymczasem warto rozróżnić dwie sytuacje:

- **Własny sklep internetowy** – masz pełną kontrolę nad nazwą pliku, tekstem alternatywnym, danymi strukturalnymi i szybkością strony. Tu SEO zdjęć realnie pomaga w Google, w tym w Google Grafika i w wynikach produktowych.
- **Marketplace i ogłoszenia** (OLX, Vinted, eBay, Amazon) – zwykle nie ustawiasz tekstu alt, a nazwa wgranego pliku nie jest widoczna dla kupujących. Platformy nie publikują, jak ich wyszukiwarki oceniają zdjęcia, więc nie będziemy zgadywać. Pewne jest jedno: dobre zdjęcie łatwiej przyciąga kliknięcie, a słabe lub niezgodne z zasadami może zostać odrzucone.

Dlatego ten poradnik zaczyna od tego, co możesz zrobić we własnym sklepie, a kończy na jakości zdjęć, która liczy się wszędzie.

## Nazwa pliku – opisowa, krótka, bez polskich znaków

Nazwa pliku to jedna z wskazówek, z których wyszukiwarka może wywnioskować, co jest na obrazku. „IMG_4821.jpg” nie mówi nic, „kubek-porcelanowy-bialy-350ml.jpg” – całkiem sporo.

- Opisz produkt tak, jak szuka go klient: rodzaj, cecha, kolor, wariant.
- Oddzielaj słowa myślnikami.
- Unikaj polskich znaków i spacji – w adresach URL zamieniają się na nieczytelne kody.
- Nie upychaj słów kluczowych na siłę. „kubek-kubek-tani-kubek-promocja.jpg” wygląda na spam.
- Dla kolejnych ujęć dodaj rozróżnienie: -przod, -bok, -detal-uchwyt.

Nazwę ustaw **przed wgraniem** do sklepu – zmiana później oznacza zwykle nowy adres pliku.

## Tekst alternatywny (alt) – opis dla ludzi i wyszukiwarek

Tekst alt czytają programy dla osób niewidomych, a wyszukiwarki wykorzystują go do zrozumienia obrazu. Dobry alt opisuje, co jest na zdjęciu, w jednym zdaniu:

- **Dobrze:** „Biały porcelanowy kubek 350 ml z czarnym uchwytem na drewnianym stole”.
- **Źle:** „kubek tani kubek najlepszy kubek sklep”.
- **Źle:** puste pole albo „zdjęcie 1”.

Każde zdjęcie w galerii produktu powinno mieć inny alt, opisujący konkretne ujęcie, np. „detal uchwytu kubka” albo „kubek w dłoni – porównanie wielkości”.

## Zdjęcia w Google Grafika i wynikach produktowych

Żeby zdjęcia z Twojego sklepu mogły pojawiać się w Google, robot musi je znaleźć i zrozumieć kontekst. W praktyce pomaga:

- **umieszczenie zdjęcia blisko opisu produktu** – tekst wokół obrazka też jest wskazówką,
- **dane strukturalne produktu** (schema.org Product) z polem image, które wiele platform sklepowych i wtyczek SEO dodaje automatycznie,
- **zwykłe znaczniki obrazka** zamiast zdjęć wstawionych jako tło w stylach CSS,
- **mapa witryny** zawierająca strony produktów,
- **unikalne zdjęcia** – te same zdjęcia producenta są na setkach stron, a Twoje własne wyróżniają się w wynikach.

## Merchant Center – zdjęcie jako warunek wyświetlania produktu

Jeśli Twój sklep przesyła produkty do Google Merchant Center, zdjęcie przestaje być tylko elementem SEO, a staje się warunkiem wyświetlania. [Wymagania Merchant Center](https://support.google.com/merchants/answer/6324350?hl=en) mówią m.in.:

- od **31 stycznia 2027** minimum **500 x 500 px**, zalecane około **1500 x 1500 px**,
- bez dodanych tekstów promocyjnych, cen, znaków wodnych, logo i ramek,
- grafiki wygenerowane przez AI muszą zachować **metadane oznaczające je jako AI** (np. pole IPTC DigitalSourceType) – nie wolno ich usuwać.

Ten ostatni punkt jest ważny, bo wiele narzędzi do kompresji domyślnie usuwa metadane. Jeśli używasz grafik AI, sprawdź ustawienia optymalizatora.

## Metadane EXIF i IPTC – co warto, a czego nie musisz robić

Poza metadanymi AI nie poświęcaj dużo czasu na wpisywanie słów kluczowych w pola EXIF czy IPTC. Nie znamy oficjalnego potwierdzenia, że poprawia to pozycje w Google, a kupujący tych danych nie widzi. Warto natomiast:

- zostawić informacje o autorze i prawach, jeśli chcesz udokumentować, że zdjęcie jest Twoje,
- usunąć dane GPS ze zdjęć robionych w domu – to kwestia prywatności, nie SEO.

## Szybkość ładowania – SEO, którego nie widać

Ciężkie zdjęcia spowalniają stronę produktu, a szybkość strony ma znaczenie i dla użytkowników, i dla Google. Kilka zasad:

- zmniejsz wymiary do tego, co wyświetla motyw (z zapasem na powiększenie),
- używaj JPG lub WebP do zdjęć – porównanie w artykule [JPG vs WebP vs PNG](https://allgrafika.pl/blog/jpg-vs-webp-vs-png-format-zdjec-produktowych),
- włącz leniwe ładowanie zdjęć poniżej pierwszego ekranu, ale nie zdjęcia głównego produktu,
- podawaj wymiary obrazka, żeby strona nie „skakała” podczas ładowania.

Rozmiary zdjęć do konkretnych platform sklepowych opisujemy w poradniku [Jaki rozmiar zdjęcia do sklepu internetowego](https://allgrafika.pl/blog/jaki-rozmiar-zdjecia-do-sklepu-internetowego).

## Jakość zdjęcia a kliknięcia na marketplace

Na OLX, Vinted, eBay i Amazonie nie ustawisz tekstu alt, a o tym, jak platforma układa wyniki, decydują jej własne zasady, których szczegółów nie publikuje. Możesz za to wpłynąć na to, czy kupujący kliknie w Twoją ofertę, gdy już ją zobaczy:

- **ostrość i światło** – rozmyte, ciemne zdjęcie wygląda na mniej wiarygodne,
- **produkt widoczny w miniaturze** – na liście wyników zdjęcie jest małe, więc przedmiot powinien zajmować większość kadru,
- **zgodność z zasadami platformy** – zdjęcie odrzucone przez moderację nie zbierze żadnych kliknięć. Zasady dla zdjęcia głównego zebraliśmy w artykule [Zdjęcie główne oferty – wymagania platform](https://allgrafika.pl/blog/zdjecie-glowne-oferty-wymagania-platform),
- **wierność** – zdjęcie, które pokazuje produkt lepiej, niż wygląda w rzeczywistości, to ryzyko zwrotów i złych opinii,
- **tytuł i opis** – zdjęcie przyciąga wzrok, ale to tekst odpowiada na pytania. Zobacz [Jak napisać tytuł ogłoszenia na OLX, Vinted i eBay](https://allgrafika.pl/blog/jak-napisac-tytul-ogloszenia-olx-vinted-ebay).

Jeśli chcesz sprawdzić, które zdjęcie działa lepiej, porównuj wersje na podobnych ofertach i patrz na liczbę wyświetleń, kliknięć i pytań od kupujących, a nie na samo wrażenie.

## Checklista SEO zdjęcia w sklepie internetowym

- [ ] Opisowa nazwa pliku bez polskich znaków, ustawiona przed wgraniem
- [ ] Unikalny tekst alt dla każdego ujęcia
- [ ] Zdjęcie blisko opisu produktu, wstawione jako zwykły obrazek
- [ ] Dane strukturalne produktu z polem image
- [ ] Plik zmniejszony i skompresowany
- [ ] Zdjęcie do Merchant Center bez napisów, logo i ramek
- [ ] Metadane AI zachowane przy grafikach z generatora
- [ ] Dane GPS usunięte

## Najczęstsze pytania

### Czy nazwa pliku ma znaczenie na OLX czy eBay?
Nazwa pliku nie jest widoczna dla kupujących, a platformy nie publikują, czy ją analizują. Opisowe nazwy przydają się za to Tobie przy porządkowaniu zdjęć.

### Ile słów powinien mieć tekst alt?
Tyle, ile trzeba, żeby opisać zdjęcie – zwykle jedno zdanie. Ważniejsze od długości jest to, żeby opis był prawdziwy i różnił się między ujęciami.

### Czy grafiki AI szkodzą SEO?
Google wymaga w Merchant Center zachowania metadanych AI, ale nie wymaga rezygnacji z takich grafik. Grafika musi wiernie pokazywać produkt – w [AllGrafika.pl](https://app.allgrafika.pl/register) AI zmienia tło, scenę i światło, a nie kształt, kolory czy logo produktu.

## Od czego zacząć

Zacznij od dobrego zdjęcia, bo żadna nazwa pliku nie uratuje nieostrego obrazu. Potem nazwa pliku, alt i kompresja we własnym sklepie, a na marketplace – zgodność z zasadami i czytelność w miniaturze. Gotowe grafiki z jednego zdjęcia z telefonu przygotujesz w [AllGrafika.pl](https://app.allgrafika.pl/register) – pierwsze 5 grafik jest darmowe po potwierdzeniu adresu e-mail.

Jakie zdjęcia przygotować dla każdej karty produktu, opisujemy na stronie [zdjęcia produktowe do sklepu internetowego](https://allgrafika.pl/zdjecia-produktowe-do-sklepu-internetowego).

[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)
  `,
  publishedAt: '2026-04-22',
  modifiedAt: '2026-10-17',
  author: 'AllGrafika.pl',
  readTime: 7,
  category: 'Optymalizacja',
}

export default post
