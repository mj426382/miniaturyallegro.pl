/**
 * Who sends AllGrafika e-mails (spec 16, AC-NOT-012; UŚUDE art. 5 and Prawo komunikacji elektronicznej:
 * a commercial message must identify the sender). The single backend source for the footer of every mail.
 *
 * Must equal LEGAL_ENTITY in landing-page/src/legal/entity.ts (the legal texts) – a test reads that file
 * and fails when the two drift. Change both together.
 */
export const SENDER_IDENTITY = {
  brand: 'AllGrafika',
  /** Full business name as registered in CEIDG. */
  name: 'Jan-Mat Mateusz Janduła',
  address: 'ul. Rzeszowska 3B, 26-600 Radom',
  nip: '9482625280',
  email: 'kontakt@allgrafika.pl',
} as const;

/** One line identifying the sender, e.g. "AllGrafika – Jan-Mat Mateusz Janduła, ul. …, NIP …, kontakt@…". */
export function senderIdentityLine(): string {
  const s = SENDER_IDENTITY;
  return `${s.brand} – ${s.name}, ${s.address}, NIP ${s.nip}, ${s.email}`;
}
