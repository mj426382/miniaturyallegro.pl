/**
 * Dane identyfikacyjne Usługodawcy / Administratora danych (działalność gospodarcza wpisana do CEIDG).
 * Ten plik ma swoją kopię w drugim pakiecie (frontend/landing-page) – oba muszą być identyczne.
 */
export const LEGAL_ENTITY = {
  /** Pełna nazwa przedsiębiorcy zgodna z wpisem do CEIDG */
  name: 'Jan-Mat Mateusz Janduła',
  /** Adres siedziby */
  address: 'ul. Rzeszowska 3B, 26-600 Radom',
  nip: '9482625280',
  register: 'przedsiębiorca wpisany do Centralnej Ewidencji i Informacji o Działalności Gospodarczej (CEIDG)',
  phone: '+48 881 358 838',
  email: 'kontakt@allgrafika.pl',
  domains: 'allgrafika.pl oraz app.allgrafika.pl',
}

export const LEGAL_DATES = {
  /** Data wejścia w życie bieżącej wersji dokumentów */
  effective: '4 października 2026 r.',
  effectiveIso: '2026-10-04',
}

export const PRICING = {
  freeCredits: 10,
  starterStyles: 3,
  allStyles: 19,
  descriptionPromptEdits: 5,
  descriptionEditPack: 15,
}

export const PROCESSORS = [
  {
    name: 'Backblaze, Inc.',
    role: 'przechowywanie przesłanych zdjęć i wygenerowanych grafik (Backblaze B2 Cloud Storage)',
    location: 'USA – transfer na podstawie EU-U.S. Data Privacy Framework / standardowych klauzul umownych',
    url: 'https://www.backblaze.com/company/privacy.html',
  },
  {
    name: 'Stripe Payments Europe, Ltd. / Stripe, Inc.',
    role: 'obsługa płatności (dane kart nie trafiają do Administratora)',
    location: 'Irlandia / USA',
    url: 'https://stripe.com/pl/privacy',
  },
  {
    name: 'Google LLC (Gemini API)',
    role: 'generowanie grafik na podstawie przesłanego zdjęcia produktu',
    location: 'USA – transfer na podstawie EU-U.S. Data Privacy Framework; dane z płatnego API nie są używane do trenowania modeli',
    url: 'https://ai.google.dev/gemini-api/terms',
  },
  {
    name: 'OpenAI, L.L.C. / OpenAI Ireland Ltd.',
    role: 'automatyczny opis produktu i przygotowanie instrukcji dla modelu graficznego',
    location: 'USA / Irlandia – transfer na podstawie EU-U.S. Data Privacy Framework / standardowych klauzul umownych; dane przesyłane przez API nie są używane do trenowania modeli',
    url: 'https://openai.com/policies/privacy-policy',
  },
  {
    name: 'Allegro.pl sp. z o.o.',
    role: 'integracja z kontem sprzedawcy (pobieranie zdjęć ofert i publikacja grafik) – wyłącznie po połączeniu konta przez Użytkownika',
    location: 'Polska',
    url: 'https://allegro.pl/regulamin/pl/polityka-prywatnosci',
  },
  {
    name: 'Google LLC (Google Sign-In)',
    role: 'logowanie kontem Google – wyłącznie gdy wybierzesz tę opcję',
    location: 'USA / Irlandia',
    url: 'https://policies.google.com/privacy',
  },
  {
    name: 'Plausible Insights OÜ (Estonia) lub własna instancja Umami',
    role: 'statystyki odwiedzin bez plików cookies i bez identyfikacji osób (dane zagregowane)',
    location: 'Unia Europejska',
    url: 'https://plausible.io/privacy',
  },
  {
    name: 'Dostawca hostingu aplikacji i serwera pocztowego',
    role: 'utrzymanie infrastruktury serwerowej, wysyłka wiadomości transakcyjnych (np. reset hasła)',
    location: 'Unia Europejska',
    url: null,
  },
]
