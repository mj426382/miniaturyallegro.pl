import { renderEmail } from './email-template';
import { SENDER_IDENTITY } from '../common/legal-entity';
import { landingLegalEntity } from '../../test/legal-entity-source';

describe('e-mail sender footer (spec 16)', () => {
  it('[AC-NOT-012] the backend sender data equal LEGAL_ENTITY of the landing page (no drift)', () => {
    const legal = landingLegalEntity();
    expect({
      name: SENDER_IDENTITY.name,
      address: SENDER_IDENTITY.address,
      nip: SENDER_IDENTITY.nip,
      email: SENDER_IDENTITY.email,
    }).toEqual(legal);
    expect(legal.nip).toMatch(/^\d{10}$/);
  });

  it('[AC-NOT-012] every rendered mail ends with company, address, NIP and contact in HTML and text', () => {
    const legal = landingLegalEntity();
    const minimal = renderEmail({ heading: 'Test', paragraphs: ['Treść'] });
    const full = renderEmail({
      heading: 'Test',
      paragraphs: ['Treść <b>'],
      cta: { label: 'Otwórz', url: 'https://app.allgrafika.pl' },
      footer: ['Powód wysyłki', { text: 'Wypisz się', link: { label: 'tutaj', url: 'https://app.allgrafika.pl/x' } }],
    });
    for (const mail of [minimal, full]) {
      for (const value of [legal.name, legal.address, `NIP ${legal.nip}`, legal.email]) {
        expect(mail.text).toContain(value);
        expect(mail.html).toContain(value);
      }
      // The identification is the last thing in the plain-text version.
      expect(mail.text.trim().split('\n').pop()).toContain(`NIP ${legal.nip}`);
      expect(mail.html).toContain(`mailto:${legal.email}`);
    }
  });
});
