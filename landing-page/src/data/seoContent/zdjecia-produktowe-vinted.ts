import type { SeoContent } from '../seoContentLoader'
import { NO_INTEGRATION_FAQ, PRICE_FAQ, SRC } from '../seoShared'

const content: SeoContent = {
  lead: 'Vinted ma wyjątkowo ścisłe zasady zdjęć: mają być zrobione przez Ciebie i przedstawiać przedmiot takim, jaki jest. Dlatego na Vinted nie wstawiaj scen ani teł wygenerowanych przez AI. AllGrafika przyda się tu inaczej – do przygotowania kadru Twojego zdjęcia pod Vinted i do opisu ogłoszenia.',
  sections: [
    {
      heading: 'Co mówią zasady katalogu Vinted',
      paragraphs: [
        'Zasady katalogu Vinted wymagają, by zdjęcia były ostre, zrobione przez sprzedawcę z myślą o Vinted i przedstawiały przedmiot takim, jaki jest – bez edycji obrazu. Nie można zastępować ich zdjęciami stockowymi, zdjęciami z reklam ani zdjęciami ze znakiem wodnym. Pierwsze zdjęcie powinno pokazywać cały przedmiot, a do ogłoszenia możesz dodać do 20 zdjęć.',
        'Poradnik Vinted zaleca jednolite, neutralne tło, światło dzienne bez lampy błyskowej i filtrów oraz unikanie kolaży. Przy markowych rzeczach warto pokazać metki i detale potwierdzające autentyczność, a wady – wprost.',
      ],
      bullets: [
        'Własne zdjęcia przedmiotu, bez edycji i filtrów',
        'Cały przedmiot na pierwszym zdjęciu',
        'Wady i ślady użytkowania pokazane wprost',
        'Bez zdjęć z internetu, stockowych i znaków wodnych',
      ],
    },
    {
      heading: 'Jak zrobić dobre zdjęcia na Vinted telefonem',
      paragraphs: ['Dobre zdjęcie na Vinted to nie efekt edycji, tylko przygotowania. Sprawdzony porządek:'],
      steps: [
        'Wypierz i wyprasuj ubranie albo wyczyść buty – zagniecenia i kurz widać na każdym zdjęciu.',
        'Połóż rzecz płasko na jasnym, jednolitym tle albo powieś na wieszaku na tle ściany.',
        'Fotografuj w dzień przy oknie, bez lampy błyskowej i bez filtrów.',
        'Pierwsze zdjęcie: cały przedmiot z przodu. Kolejne: tył, metka z rozmiarem i składem, detale, wady.',
        'Przy butach dodaj podeszwę i wnętrze – więcej w poradniku [jak fotografować buty do sprzedaży](/blog/jak-fotografowac-buty-do-sprzedazy).',
      ],
    },
    {
      heading: 'Jak AllGrafika pomaga przy Vinted',
      paragraphs: [
        'Na Vinted używaj zdjęć prosto z telefonu. W AllGrafika możesz pobrać je z presetem eksportu pod Vinted, który tylko dopasowuje kadr i rozmiar pliku – nie zmieniaj przy tym kolorów, jasności ani tła. Dostajesz też opis ogłoszenia dopasowany do Vinted: rozmiar, marka, materiał, stan i wymiary w czytelnej kolejności.',
        'Style AI ze scenami i nowym tłem zostaw na [sklep internetowy](/zdjecia-produktowe-do-sklepu-internetowego) i platformy, które je dopuszczają, np. [eBay](/zdjecia-produktowe-ebay) przy nowych produktach.',
      ],
    },
  ],
  faq: [
    {
      q: 'Czy mogę wstawić na Vinted zdjęcie wygenerowane przez AI?',
      a: 'Nie polecamy tego. Zasady katalogu Vinted wymagają własnych zdjęć przedmiotu bez edycji obrazu, więc scena albo tło z AI mogą zostać uznane za naruszenie. Wstaw zwykłe zdjęcia z telefonu.',
    },
    {
      q: 'Ile zdjęć można dodać na Vinted?',
      a: 'Według zasad katalogu Vinted do jednego ogłoszenia dodasz do 20 zdjęć. Pierwsze powinno pokazywać cały przedmiot, kolejne detale, metki i ewentualne wady.',
    },
    {
      q: 'Czy mogę rozjaśnić zdjęcie przed wstawieniem na Vinted?',
      a: 'Zasady katalogu mówią, że zdjęcie ma przedstawiać przedmiot takim, jaki jest, bez edycji obrazu. Zamiast poprawiać zdjęcie, zrób je ponownie w lepszym świetle dziennym.',
    },
    PRICE_FAQ,
    NO_INTEGRATION_FAQ,
  ],
  sources: [SRC.vintedRules, SRC.vintedHelp],
}

export default content
