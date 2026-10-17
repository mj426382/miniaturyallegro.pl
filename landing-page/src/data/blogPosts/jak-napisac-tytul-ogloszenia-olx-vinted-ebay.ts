import type { BlogPostData } from '../blogPosts'

const post: BlogPostData = {
  id: '59',
  slug: 'jak-napisac-tytul-ogloszenia-olx-vinted-ebay',
  title: 'Jak napisać tytuł ogłoszenia na OLX, Vinted i eBay',
  excerpt: 'Tytuł ogłoszenia na OLX, Vinted, eBay i Amazon: limity znaków ze źródeł, kolejność słów, zakazane znaki oraz dobre i złe przykłady.',
  content: `
## Tytuł to pierwsze, co czyta kupujący

Na liście wyników kupujący widzi zdjęcie, cenę i tytuł. Zdjęcie przyciąga wzrok, ale to tytuł mówi, czy w ogóle trafił na to, czego szuka. Jest też tekstem, który wyszukiwarka platformy dopasowuje do zapytania – jeśli brakuje w nim słowa, które wpisuje kupujący, Twoje ogłoszenie może się nie wyświetlić.

Każda platforma ma inne limity i trochę inne zwyczaje. Poniżej znajdziesz zasady wspólne, różnice między OLX, Vinted, eBay i Amazon oraz przykłady dobrych i słabych tytułów.

## Uniwersalny wzór tytułu

Najprostszy schemat, który sprawdza się prawie wszędzie:

**Co to jest + marka/model + najważniejsza cecha + wariant (rozmiar, kolor, pojemność) + stan**

- **Najważniejsze słowo na początku** – „Kurtka zimowa damska…”, a nie „Piękna, ciepła, modna kurtka…”. Początek tytułu widać zawsze, końcówka bywa ucięta na telefonie.
- **Konkrety zamiast przymiotników** – „puchowa”, „rozmiar M”, „128 GB” mówią więcej niż „super” czy „rewelacyjna”.
- **Słowa, których szukają ludzie** – sprawdź podpowiedzi w wyszukiwarce platformy i zobacz, jak kupujący nazywają ten produkt.
- **Jeden produkt w jednym tytule** – zestaw opisz jako zestaw, zamiast wymieniać wszystkie modele, do których coś „może pasować”.

## Limity znaków: co mówią źródła

Limity zmieniają się, a nie każda platforma publikuje je w jednym miejscu. Oto, co udało się potwierdzić w oficjalnych materiałach:

- **eBay** – tytuł do **80 znaków**, opcjonalny podtytuł do 55 znaków. Źródło: [dokumentacja eBay dla deweloperów](https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/listing-title.html).
- **OLX** – według [dokumentacji API dla partnerów OLX Group](https://developer.olxgroup.com/docs/validations-required-for-olx-export) tytuł ma od 5 do 70 znaków, a zbyt długi nie jest skracany, tylko blokuje publikację. To zasady dla ogłoszeń wysyłanych przez API – limit w zwykłym formularzu sprawdź przy dodawaniu ogłoszenia lub w pomocy OLX.
- **Amazon** – według [ogłoszenia Amazon na forum sprzedawców](https://sellercentral.amazon.com/seller-forums/discussions/t/b2b15728-0d43-453e-974f-59eb63f73059) od 21 stycznia 2025 r. tytuł w większości kategorii może mieć do 200 znaków ze spacjami, nie może zawierać znaków takich jak ! $ ? _ { } ^ ¬ ¦ (chyba że są częścią nazwy marki), a to samo słowo nie może wystąpić więcej niż dwa razy (nie dotyczy przyimków, spójników i rodzajników). Sprawdź aktualne zasady swojej kategorii w Seller Central.
- **Vinted** – nie znaleźliśmy oficjalnej informacji o limicie znaków w tytule. Formularz sam pokaże, ile możesz wpisać.

Wniosek praktyczny: pisz tak, żeby najważniejsze informacje zmieściły się w pierwszych kilkudziesięciu znakach. Wtedy ten sam rdzeń tytułu przeniesiesz między platformami i tylko dopiszesz szczegóły tam, gdzie jest miejsce.

## OLX: tytuł, który odpowiada na zapytanie

Na OLX kupujący często wpisuje krótkie, potoczne frazy: „rower dziecięcy 20 cali”, „wózek głęboko-spacerowy”. Tytuł powinien brzmieć podobnie.

- Zacznij od nazwy przedmiotu w formie, w jakiej się go szuka.
- Dodaj markę i model, jeśli są znane.
- Zakończ parametrem, który najczęściej decyduje (rozmiar, rocznik, pojemność).
- Nie wpisuj numeru telefonu ani ceny – to miejsce na nazwę przedmiotu.

**Dobrze:** „Rower dziecięcy Kross 20 cali, 6 biegów, niebieski”
**Słabo:** „SPRZEDAM!!! Super rowerek okazja tanio”

## Vinted: marka, rozmiar i stan

Na Vinted wiele osób filtruje po marce i rozmiarze, a tytuł potwierdza, że to dokładnie ta rzecz.

- Marka i rodzaj rzeczy na początku: „Levi’s 501 jeansy…”.
- Rozmiar w tytule, nawet jeśli wybierasz go też z listy.
- Krótka informacja o stanie lub cesze, która wyróżnia egzemplarz.

**Dobrze:** „Levi’s 501 jeansy męskie W32 L32 ciemny granat”
**Słabo:** „Spodnie fajne mało noszone”

## eBay: precyzja i słowa kluczowe

Na eBay kupujący wpisuje bardzo konkretne zapytania – model, numer części, kompatybilność. 80 znaków pozwala zmieścić sporo, ale każde słowo powinno pracować.

- Marka, model i numer katalogowy (jeśli istnieje).
- Kluczowe parametry: pojemność, rozmiar, kolor.
- Stan („new”, „used”) wybierasz w osobnym polu – nie musisz go dublować w tytule, jeśli brakuje miejsca.

**Dobrze:** „Sony WH-1000XM4 Wireless Noise Cancelling Headphones Black”
**Słabo:** „L@@K!! Amazing headphones best price WOW”

## Amazon: porządek i zasady

Na Amazon tytuł zwykle buduje się według schematu marka + linia produktu + rodzaj + kluczowa cecha + wariant. Zwróć uwagę na zasady z ogłoszenia z 2025 r.: limit długości, zakaz niektórych znaków specjalnych i powtarzania słów.

**Dobrze:** „Marka X Butelka termiczna 750 ml, stal nierdzewna, czarna”
**Słabo:** „Butelka termiczna butelka na wodę butelka sportowa!!!”

## Najczęstsze błędy w tytułach

- **Wielkie litery i wykrzykniki** – wyglądają jak spam, a na Amazon niektóre znaki są wprost zakazane.
- **Puste słowa** – „okazja”, „hit”, „najtaniej” zajmują miejsce, a nikt ich nie wpisuje w wyszukiwarkę.
- **Upychanie fraz** – powtarzanie tego samego słowa w kilku formach utrudnia czytanie.
- **Niezgodność ze zdjęciem** – tytuł obiecuje zestaw, a zdjęcie pokazuje jeden element. Kupujący to zauważy.

## Jak sprawdzić, czy nowy tytuł działa

Zmieniaj jedną rzecz naraz i porównuj wyświetlenia oraz wiadomości od kupujących w podobnych okresach. Więcej o rzetelnym porównywaniu wersji przeczytasz w artykule [jak zwiększyć CTR testami A/B](https://allgrafika.pl/blog/jak-zwiekszyc-ctr-ab-testowanie-miniaturek).

## Tytuł, zdjęcie i opis razem

Tytuł obiecuje, zdjęcie potwierdza, opis odpowiada na pytania. O opisie piszemy w poradniku [jak napisać opis produktu do sklepu i ogłoszenia](https://allgrafika.pl/blog/jak-napisac-opis-produktu-do-sklepu-i-ogloszenia).

W [AllGrafika.pl](https://app.allgrafika.pl/register) do każdego zdjęcia z gotową grafiką bezpłatnie dostaniesz propozycję tytułu i opisu dopasowaną do wybranej platformy. Tekst kopiujesz do ogłoszenia sam, więc przed publikacją sprawdź długość w formularzu i zgodność z faktami.

[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)
  `,
  publishedAt: '2026-05-30',
  modifiedAt: '2026-10-17',
  author: 'AllGrafika.pl',
  readTime: 6,
  category: 'E-commerce',
}

export default post
