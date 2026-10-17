import type { SeoContent } from '../seoContentLoader'
import { NO_INTEGRATION_FAQ, PRICE_FAQ, SRC } from '../seoShared'

const content: SeoContent = {
  lead: 'Na OLX kupujący ocenia przedmiot po kilku zdjęciach z listy ogłoszeń. AllGrafika pomaga przygotować je z Twojego zdjęcia z telefonu: wyprostujesz i wykadrujesz kadr presetem pod OLX, poprawisz jasność, a dla nowych produktów zrobisz czyste zdjęcie na białym tle. Do tego krótki opis ogłoszenia do skopiowania.',
  sections: [
    {
      heading: 'Jakie zdjęcia działają na OLX',
      paragraphs: [
        'Pomoc OLX wskazuje, że zdjęcia mają przedstawiać wyłącznie oferowany przedmiot, nie mogą pochodzić z internetu ani zawierać danych kontaktowych, takich jak numer telefonu. Starszy artykuł pomocy OLX podaje limit 8 zdjęć i 5 MB na plik w formatach JPG i PNG – aktualne wartości sprawdź w formularzu dodawania ogłoszenia.',
        'Przy rzeczach używanych najważniejsza jest uczciwość: pokaż przedmiot w całości, z kilku stron i z ewentualnymi śladami użytkowania. Takie zdjęcia ograniczają pytania i nieporozumienia przy odbiorze.',
      ],
      bullets: ['Pierwsze zdjęcie: cały przedmiot, ostro i w dobrym świetle', 'Kolejne: detale, metki, numery seryjne, wady', 'Bez numeru telefonu, napisów i zdjęć z internetu'],
    },
    {
      heading: 'Zestaw zdjęć do ogłoszenia – checklista',
      paragraphs: ['Zanim klikniesz „Dodaj ogłoszenie”, przejdź przez tę listę. Zajmuje kilka minut, a oszczędza wiele wiadomości z pytaniami.'],
      steps: [
        'Wyczyść przedmiot i ustaw go na jednolitym, jasnym tle – ściana, prześcieradło albo duży arkusz papieru.',
        'Fotografuj przy oknie, bez lampy błyskowej, która tworzy odblaski i ostre cienie.',
        'Zrób zdjęcie całego przedmiotu z przodu – to będzie zdjęcie główne na liście ogłoszeń.',
        'Dodaj zdjęcia z boku i z tyłu oraz zbliżenia metki, tabliczki znamionowej lub numeru modelu.',
        'Pokaż wprost wszystkie wady: rysy, przetarcia, braki w zestawie.',
        'Sprawdź, czy na żadnym zdjęciu nie widać numeru telefonu, adresu ani innych danych.',
      ],
    },
    {
      heading: 'Co robi AllGrafika przy ogłoszeniu na OLX',
      paragraphs: [
        'Preset eksportu pod OLX ustawia kadr 4:3 i rozmiar pliku 1500 × 1125 px w formacie JPG lub PNG, a narzędzia kadrowania, obrotu i korekty jasności poprawiają zdjęcie z telefonu bez zmiany samego przedmiotu. Dla nowych produktów możesz wygenerować [zdjęcie na białym tle](/biale-tlo-zdjecie-produktu) albo aranżację – zawsze z produktem wiernym oryginałowi.',
        'Opis ogłoszenia dopasowany do OLX dostajesz gratis do każdego zdjęcia z gotową grafiką: krótki tytuł z najważniejszą frazą, stan, parametry i informacje o odbiorze. Weryfikujesz go i wklejasz do formularza OLX samodzielnie. Jak napisać dobry tytuł, opisujemy w poradniku [tytuł ogłoszenia na OLX, Vinted i eBay](/blog/jak-napisac-tytul-ogloszenia-olx-vinted-ebay).',
      ],
    },
    {
      heading: 'OLX, Vinted czy własny sklep',
      paragraphs: [
        'Te same zdjęcia nie wszędzie są dozwolone. Na [Vinted](/zdjecia-produktowe-vinted) obowiązują własne zdjęcia bez edycji, więc tam wstawiaj zdjęcia prosto z telefonu. Jeśli sprzedajesz więcej nowych produktów, rozważ też [zdjęcia do sklepu internetowego](/zdjecia-produktowe-do-sklepu-internetowego) w jednym standardzie dla całego katalogu.',
      ],
    },
  ],
  faq: [
    {
      q: 'Czy na OLX można wstawić zdjęcie na białym tle z AI?',
      a: 'Zdjęcie musi przedstawiać oferowany przedmiot. Przy nowych produktach packshot z Twojego zdjęcia pokazuje ten sam produkt bez zmian w wyglądzie. Przy rzeczach używanych dodaj też zwykłe zdjęcia aktualnego stanu.',
    },
    {
      q: 'Jaki format i rozmiar zdjęcia na OLX?',
      a: 'Pomoc OLX wymienia pliki JPG i PNG do 5 MB. Preset AllGrafika pod OLX zapisuje zdjęcie w proporcji 4:3 w rozmiarze 1500 × 1125 px; plik JPG w tym rozmiarze zwykle waży wyraźnie mniej niż 5 MB.',
    },
    PRICE_FAQ,
    NO_INTEGRATION_FAQ,
  ],
  sources: [SRC.olx],
}

export default content
