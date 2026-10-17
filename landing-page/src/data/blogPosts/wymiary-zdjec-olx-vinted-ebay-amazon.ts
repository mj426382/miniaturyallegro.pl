import type { BlogPostData } from '../blogPosts'

const post: BlogPostData = {
  id: '101',
  slug: 'wymiary-zdjec-olx-vinted-ebay-amazon',
  title: 'Wymiary zdjęć OLX, Vinted, eBay i Amazon – limity 2026',
  excerpt: 'Wymiary zdjęć na OLX, Vinted, eBay i Amazon: piksele, formaty, waga pliku i limit zdjęć w jednej tabeli, ze źródłami i typowymi błędami przy wgrywaniu.',
  content: `
## Dlaczego jedno zdjęcie nie pasuje wszędzie

Robisz jedno ładne zdjęcie produktu i chcesz wystawić go w kilku miejscach naraz: na OLX, na Vinted, na eBay i może na Amazonie. Szybko okazuje się, że każda platforma przyjmuje pliki inaczej. Jedna ma limit 5 MB, inna przyjmuje 12 MB, jedna pozwala na 8 zdjęć, inna na 24, a niektóre parametry w ogóle nie są oficjalnie opisane.

W tym poradniku zebraliśmy **wymiary zdjęć, formaty, wagę plików i liczbę zdjęć** na czterech platformach – tylko z oficjalnych stron pomocy i z wyraźnym oznaczeniem, gdzie dane są starsze albo niepełne. Zasady dotyczące treści zdjęcia głównego (tło, napisy, znaki wodne) opisujemy osobno w artykule [Zdjęcie główne oferty – wymagania platform](https://allgrafika.pl/blog/zdjecie-glowne-oferty-wymagania-platform).

## Tabela: piksele, formaty i waga plików na czterech platformach

| Platforma | Liczba zdjęć | Rozdzielczość | Formaty | Maks. waga pliku |
|-----------|--------------|---------------|---------|------------------|
| OLX | do 8 (wg starszego artykułu pomocy) | 1500 x 1205 px (wg starszego artykułu pomocy) | jpg, jpeg, png | 5 MB |
| Vinted | do 20 | brak oficjalnych danych – sprawdź w pomocy | brak oficjalnych danych – sprawdź w pomocy | brak oficjalnych danych – sprawdź w pomocy |
| eBay | do 24 | min. 500 x 500 px, zalecane ok. 1600 x 1600 px | JPEG, PNG, GIF, TIFF, BMP, WEBP, HEIC, AVIF | 12 MB |
| Amazon | brak oficjalnych danych – sprawdź w pomocy | 500–10 000 px na dłuższym boku, powyżej 1000 px dla zoomu | JPEG (preferowany), TIFF, PNG, GIF bez animacji | brak oficjalnych danych – sprawdź w pomocy |

Stan na październik 2026. Platformy zmieniają limity bez zapowiedzi, więc przed dużą sesją zdjęciową zajrzyj do linków poniżej.

## OLX – co wiadomo o limitach zdjęć w ogłoszeniu

Centrum pomocy OLX wymaga logowania i nie zawsze da się je otworzyć bez konta, dlatego dane pochodzą ze starszego artykułu [Jak dodać ogłoszenie](https://pomoc.olx.pl/hc/pl/articles/211658765-Jak-doda%C4%87-og%C5%82oszenie-). Według tej pomocy OLX:

- do ogłoszenia możesz dodać **maksymalnie 8 zdjęć**,
- maksymalna wielkość to **5 MB** (format 4:3) lub **1500 x 1205 pikseli**,
- akceptowane formaty to **jpg, jpeg i png**.

Artykuł ma kilka lat, więc obecne limity mogą być inne – sprawdź je w formularzu dodawania ogłoszenia. Dla integracji partnerskich OLX publikuje osobne [zasady walidacji eksportu](https://developer.olxgroup.com/docs/validations-required-for-olx-export): co najmniej jedno zdjęcie, krótszy bok minimum 300 px i plik do 5 MB. To reguły dla API, nie dla zwykłego formularza, ale dobrze pokazują dolną granicę.

**Praktycznie:** przygotuj zdjęcie w proporcji 4:3, zapisz jako JPG i pilnuj, żeby plik ważył wyraźnie mniej niż 5 MB.

## Vinted – liczba zdjęć i zasady katalogu

Vinted oficjalnie podaje tylko jedną liczbę: **do 20 zdjęć w jednym ogłoszeniu** ([zasady katalogu Vinted](https://www.vinted.com/catalog-rules)). Rozdzielczości, formatów, maksymalnej wagi pliku ani proporcji nie znaleźliśmy na żadnej oficjalnej stronie – w tej sprawie sprawdź pomoc Vinted lub po prostu aplikację, która sama przeskaluje zdjęcie z telefonu.

Ważniejsze od pikseli są tu zasady treści. Vinted wymaga, by zdjęcia były ostre, zrobione przez Ciebie i pokazywały przedmiot takim, jaki jest – regulamin mówi wprost, że edycja obrazu nie jest dozwolona. [Wskazówki Vinted](https://www.vinted.pl/help/3/377-jak-zrobic-swietne-zdjecia-wskazowki) radzą neutralne tło, światło dzienne i całość przedmiotu na pierwszym zdjęciu. Na Vinted wrzucaj więc **własne, prawdziwe zdjęcia** prosto z telefonu, a nie wygenerowane sceny.

## eBay – najdokładniej opisane parametry

eBay ma najbardziej konkretną stronę pomocy o [dodawaniu zdjęć do ofert](https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148):

- **do 24 zdjęć** w ofercie, pierwsze jest zdjęciem głównym,
- minimum **500 x 500 px**, zalecane około **1600 x 1600 px**,
- formaty JPEG, PNG, GIF, TIFF, BMP, WEBP, HEIC i AVIF,
- maksymalnie **12 MB** na zdjęcie,
- najlepiej wyglądają proporcje **1:1 lub 16:9**.

Dodatkowo [polityka zdjęć eBay](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370) wymaga co najmniej jednego zdjęcia o dłuższym boku minimum 500 px i zabrania dodanych ramek, tekstu oraz znaków wodnych.

## Amazon – rozdzielczość pod zoom i format JPEG

Oficjalna strona wymagań Amazon dla zdjęć jest dostępna dopiero po zalogowaniu do Seller Central. Poniższe dane pochodzą z [wpisu pracownika Amazon na forum sprzedawców](https://sellercentral.amazon.com/seller-forums/discussions/t/4b3c4c39-6f8c-4312-aa0e-99982eb8f5e1), więc traktuj je jako wytyczne Amazon dla sprzedawców i potwierdź w swoim koncie:

- dłuższy bok od **500 do 10 000 px**,
- Amazon woli zdjęcia **powyżej 1000 px** na dłuższym boku, bo wtedy działa powiększanie,
- akceptowane formaty: JPEG, TIFF, PNG i GIF bez animacji, **preferowany JPEG**,
- zdjęcie bez pikselozy i postrzępionych krawędzi.

Maksymalnej wagi pliku ani limitu liczby zdjęć nie podajemy – w oficjalnych źródłach, do których mieliśmy dostęp, nie było tych danych.

## Jeden plik źródłowy, cztery eksporty – jak to zorganizować

Najprościej pracować na jednym dużym pliku źródłowym i z niego robić wersje pod każdą platformę:

1. **Zachowaj oryginał** w pełnej rozdzielczości, bez kompresji.
2. **Eksport pod eBay i Amazon:** kwadrat, dłuższy bok około 1600 px – mieści się w zaleceniu eBay i przekracza próg zoomu na Amazonie.
3. **Eksport pod OLX:** kadr 4:3, JPG, plik wyraźnie poniżej 5 MB.
4. **Vinted:** wrzuć własne zdjęcie z telefonu, najwyżej przycięte i wyprostowane, bez zmiany wyglądu przedmiotu.
5. **Nazwij pliki** tak, żebyś wiedział, która wersja jest dla której platformy, np. kubek-ebay-1600.jpg.

W [AllGrafika.pl](https://app.allgrafika.pl/register) przy pobieraniu gotowej grafiki wybierasz preset eksportu: OLX, Vinted, eBay, Amazon albo ogólny sklep internetowy. Pliki pobierasz na dysk i sam dodajesz je do ogłoszenia – aplikacja nie łączy się z kontami na platformach.

## Typowe błędy przy wgrywaniu i jak je naprawić

- **Zdjęcie jest za małe.** Typowe przy zrzutach ekranu albo plikach pobranych z komunikatora. Zrób zdjęcie od nowa w pełnej rozdzielczości aparatu – powiększanie małego pliku daje rozmyty obraz.
- **Plik jest za duży.** Zdjęcia z nowych telefonów potrafią ważyć kilka megabajtów. Zmniejsz wymiary do potrzebnych i zapisz JPG z umiarkowaną kompresją.
- **Nieobsługiwany format.** iPhone domyślnie zapisuje zdjęcia w HEIC. eBay go przyjmuje, ale starsza pomoc OLX wymienia tylko jpg, jpeg i png, więc przed wysyłką przekonwertuj plik na JPG.
- **Ucięty produkt w miniaturze.** Gdy platforma przycina zdjęcie do kwadratu, produkt przy krawędzi kadru znika. Zostaw margines wokół przedmiotu.
- **Dane kontaktowe na zdjęciu.** Według pomocy OLX zdjęcie nie może zawierać np. numeru telefonu. Na eBay zakazane są też napisy i znaki wodne.
- **Zdjęcie z internetu.** OLX i Vinted wymagają, by zdjęcia nie pochodziły z sieci. Więcej o tym w artykule [Prawa autorskie do zdjęć produktów](https://allgrafika.pl/blog/prawa-autorskie-do-zdjec-produktow).

## Najczęstsze pytania

### Jaki rozmiar zdjęcia jest bezpieczny na wszystkich czterech platformach?
Kwadrat o boku około 1600 px w JPG, ważący kilkaset kilobajtów do kilku megabajtów, spełnia oficjalne wymagania eBay i wytyczne Amazon, a po przycięciu do 4:3 pasuje też na OLX. Dla Vinted oficjalnych wymiarów nie ma.

### Czy mogę wgrać WebP?
eBay oficjalnie przyjmuje WEBP. Amazon i starsza pomoc OLX go nie wymieniają, więc tam wybierz JPG. Porównanie formatów znajdziesz w artykule [JPG vs WebP vs PNG](https://allgrafika.pl/blog/jpg-vs-webp-vs-png-format-zdjec-produktowych).

### Ile zdjęć warto dodać?
Tyle, ile potrzeba, żeby pokazać produkt z każdej strony, detale i ewentualne wady. Limity to 8 na OLX (wg starszej pomocy), 20 na Vinted i 24 na eBay.

### Co z rozmiarem zdjęć w moim sklepie internetowym?
To osobny temat – zależy od motywu sklepu i Google Merchant Center. Opisujemy go w poradniku [Jaki rozmiar zdjęcia do sklepu internetowego](https://allgrafika.pl/blog/jaki-rozmiar-zdjecia-do-sklepu-internetowego).

## Podsumowanie

Najwięcej konkretów podaje eBay, Amazon udostępnia szczegóły po zalogowaniu, OLX ma starsze dane, a Vinted określa tylko liczbę zdjęć. Pracuj na jednym dużym oryginale, z którego eksportujesz wersje pod każdą platformę, i sprawdzaj aktualne limity w pomocy przed każdą większą zmianą. Jeśli chcesz z jednego zdjęcia z telefonu zrobić gotowe grafiki z eksportem pod OLX, eBay i Amazon, wypróbuj [AllGrafika.pl](https://app.allgrafika.pl/register) – pierwsze 5 grafik jest darmowe po potwierdzeniu adresu e-mail.

[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)
  `,
  publishedAt: '2026-10-09',
  modifiedAt: '2026-10-17',
  author: 'AllGrafika.pl',
  readTime: 7,
  category: 'Technologia',
}

export default post
