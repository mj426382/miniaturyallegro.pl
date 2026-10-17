import type { BlogPostData } from '../blogPosts'

const post: BlogPostData = {
  id: '16',
  slug: 'jak-ai-generuje-opisy-i-style-miniaturek',
  title: 'Jak AI generuje opisy i dobiera style zdjęć produktów',
  excerpt: 'Jak AllGrafika.pl analizuje zdjęcie, buduje sceny dla wybranych stylów i pisze opis pod OLX, Vinted, eBay, Amazon lub sklep. Bez tajemnic.',
  content: `
## Co dzieje się po przesłaniu zdjęcia?

Wrzucasz zdjęcie produktu z telefonu, wybierasz style, a po chwili masz gotowe grafiki i propozycję opisu. Z zewnątrz wygląda to jak magia, ale za każdym krokiem stoi konkretny proces. W tym artykule wyjaśniamy, jak działa sztuczna inteligencja w [AllGrafika.pl](https://app.allgrafika.pl/register) – jakich modeli używamy, co robią, a czego nie robią.

Najważniejsze od razu: nie trenujemy własnego modelu. Korzystamy z modeli dostawców – **Google Gemini** do tworzenia obrazów i **OpenAI** do analizy zdjęcia oraz pisania tekstów – a nasza praca polega na tym, jak te modele prowadzimy.

## Krok 1: analiza zdjęcia produktu

Najpierw model OpenAI opisuje, co widzi na zdjęciu: rodzaj produktu, kształt, kolory, materiał, widoczne napisy i logo. Ten opis powstaje raz dla każdego zdjęcia i jest potem wykorzystywany zarówno przy grafikach, jak i przy tekście oferty.

Dzięki temu każda scena jest budowana pod konkretny przedmiot. Kubek dostanie inne otoczenie niż słuchawki, nawet jeśli wybierzesz dla obu ten sam styl.

## Krok 2: Ty wybierasz style, AI dopasowuje scenę

W aplikacji jest 19 stylów w trzech grupach:

- **uniwersalne** – m.in. białe tło, lifestyle, ciemny luksus, gradient, produkt w użyciu, kolaż z kilku ujęć,
- **sezonowe** – np. Boże Narodzenie, Black Friday, Walentynki, Wielkanoc, lato,
- **branżowe** – np. moda, elektronika, kosmetyki, dom i ogród, sport, żywność.

Domyślnie zaznaczony jest zestaw startowy: białe tło, lifestyle i ciemny luksus. Możesz go zmienić i wybrać dowolne style – decyzja należy do Ciebie, aplikacja nie wybiera ich za Ciebie. Styl sezonowy, którego czas właśnie trwa, pokazujemy na początku swojej grupy.

To, co robi AI, to dopasowanie wybranego stylu do produktu. Na podstawie analizy z kroku 1 model pisze szczegółowy opis sceny dla każdego stylu: jakie tło, jakie rekwizyty, jakie światło będą pasować do tego konkretnego przedmiotu. Możesz też wpisać własny pomysł po polsku i dodać zdjęcie referencyjne.

## Krok 3: obraz z zasadą wierności produktu

Opis sceny trafia do modelu Google Gemini, który tworzy grafikę. Każde polecenie zawiera reguły integralności produktu: AI może zmieniać tło, scenę i oświetlenie, ale nie kształt, kolory, logo ani napisy na produkcie.

Modele generatywne nie są nieomylne. Dlatego zanim użyjesz grafiki, sprawdź ją: czy produkt wygląda dokładnie tak, jak to, co kupujący dostanie w paczce. Grafikę możesz poprawić poleceniem albo ocenić kciukiem w górę lub w dół – te oceny pomagają nam ulepszać style.

## Krok 4: tytuł i opis dopasowane do platformy

Do każdego zdjęcia z gotową grafiką możesz bezpłatnie wygenerować tytuł i opis oferty. Model OpenAI korzysta z analizy zdjęcia i z Twoich notatek – warto wpisać tam to, czego nie widać na zdjęciu: wymiary, materiał, stan, zawartość zestawu.

Opis jest dopasowany do platformy, którą wybierzesz: inaczej wygląda ogłoszenie na OLX czy Vinted, inaczej oferta na eBay lub Amazon, a inaczej karta produktu we własnym sklepie. Polecenie dla modelu zabrania wymyślania parametrów, dodawania linków i danych kontaktowych oraz superlatyw bez pokrycia.

Tekst możesz potem:

- edytować ręcznie bez limitu,
- poprawiać poleceniem dla AI – 5 poprawek na zdjęcie jest bezpłatnych, kolejne 15 kosztuje 1 kredyt,
- skopiować jako tytuł, sformatowany opis lub zwykły tekst.

## Dlaczego musisz sprawdzić tekst przed publikacją

AI pisze na podstawie tego, co widzi na zdjęciu i co od Ciebie dostanie. Nie zna gwarancji, składu tkaniny ani numeru modelu, jeśli ich nie podasz. Może też źle odczytać szczegół ze zdjęcia. Zanim wkleisz opis do ogłoszenia, przeczytaj go i sprawdź każdy fakt – odpowiedzialność za treść oferty ponosi sprzedawca.

Sprawdź też limity znaków na platformie, na której publikujesz. Zebraliśmy je w poradniku [jak napisać tytuł ogłoszenia na OLX, Vinted i eBay](https://allgrafika.pl/blog/jak-napisac-tytul-ogloszenia-olx-vinted-ebay).

## Czego AllGrafika nie robi

- **Nie publikuje ofert** – nie łączymy się z kontami na platformach sprzedażowych. Grafiki pobierasz (pojedynczo lub w paczce ZIP), a opis kopiujesz do ogłoszenia samodzielnie.
- **Nie wybiera stylów za Ciebie** – podpowiada zestaw startowy, ale decyzja jest Twoja.
- **Nie zmienia produktu celowo** – jeśli zauważysz zmianę w kształcie, kolorze czy napisach, nie używaj takiej grafiki i wygeneruj ją ponownie.

## Gdzie grafiki z AI mają sens

Zasady platform różnią się. Na Vinted regulamin wymaga zdjęć zrobionych przez sprzedawcę i pokazujących przedmiot bez edycji ([zasady katalogu Vinted](https://www.vinted.com/catalog-rules)), więc tam lepiej postawić na własne zdjęcia. Na eBay zdjęcia nie mogą mieć dodanego tekstu ani ramek ([zasady zdjęć eBay](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370)). Google Merchant Center wymaga, by obrazy wygenerowane przez AI zachowały metadane oznaczające je jako takie ([pomoc Google Merchant Center](https://support.google.com/merchants/answer/6324350?hl=en)). Przed publikacją zawsze sprawdź aktualne zasady platformy.

Więcej o praktycznym wykorzystaniu AI przeczytasz w artykule [jak wykorzystać AI do zdjęć produktowych](https://allgrafika.pl/blog/jak-wykorzystac-ai-do-zdjec-produktowych).

## Jak zacząć

1. Zarejestruj się w [AllGrafika.pl](https://app.allgrafika.pl/register) i potwierdź adres e-mail – pierwsze 5 grafik jest bezpłatnych.
2. Prześlij zdjęcie produktu.
3. Wybierz style albo zostaw zestaw startowy.
4. Sprawdź grafiki, wygeneruj opis pod wybraną platformę i zweryfikuj fakty.
5. Pobierz pliki i dodaj je do oferty.

[← Przejdź do strony głównej](https://allgrafika.pl/)
  `,
  publishedAt: '2026-04-17',
  modifiedAt: '2026-10-17',
  readTime: 6,
  category: 'Technologia',
}

export default post
