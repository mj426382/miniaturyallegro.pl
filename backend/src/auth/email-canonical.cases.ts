/** Input → canonical form; used by the unit test and the SQL mirror test (test/email-verification.e2e-spec.ts). */
export const CANONICAL_CASES: Array<[string, string]> = [
  ['jan.kowalski@gmail.com', 'jankowalski@gmail.com'],
  ['  Jan.Kowalski+promo@GoogleMail.com ', 'jankowalski@gmail.com'],
  ['JANKOWALSKI@gmail.com', 'jankowalski@gmail.com'],
  ['j.mateusz14+111@gmail.com', 'jmateusz14@gmail.com'],
  ['jan.kowalski+x@firma.pl', 'jan.kowalski@firma.pl'],
  ['Jan.Kowalski@Firma.PL', 'jan.kowalski@firma.pl'],
  ['anna+a+b@wp.pl', 'anna@wp.pl'],
  ['+tag@onet.pl', '+tag@onet.pl'],
  ['...@gmail.com', '...@gmail.com'],
  ['a.b@sub.gmail.com', 'a.b@sub.gmail.com'],
  ['user@domain', 'user@domain'],
  ['no-at-sign', 'no-at-sign'],
];
