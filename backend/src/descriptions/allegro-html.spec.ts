import { allegroHtmlToText, clampTitle, normalizeKeywords, sanitizeAllegroHtml } from './allegro-html';

describe('sanitizeAllegroHtml', () => {
  it('[AC-DESC-006] keeps only the tags Allegro allows and strips attributes', () => {
    const dirty =
      '<h1 class="x">Tytuł</h1><p onclick="alert(1)">Akapit <strong>mocny</strong> <em>kursywa</em> <a href="http://x">link</a></p>' +
      '<script>alert(1)</script><ul><li>jeden</li></ul><img src=x onerror=alert(1)><div>blok</div>';
    expect(sanitizeAllegroHtml(dirty)).toBe(
      '<h2>Tytuł</h2><p>Akapit <b>mocny</b> kursywa link</p><ul><li>jeden</li></ul>blok',
    );
  });

  it('[AC-DESC-007] escapes stray angle brackets and drops comments', () => {
    expect(sanitizeAllegroHtml('<p>2 < 3 <!-- c --> i > 1</p>')).toBe('<p>2 &lt; 3  i > 1</p>');
  });

  it('[AC-DESC-008] converts to readable text', () => {
    const text = allegroHtmlToText('<h2>Cechy</h2><ul><li>lekki</li><li>mocny</li></ul><p>Koniec &amp; kropka</p>');
    expect(text).toBe('Cechy\n• lekki\n• mocny\nKoniec & kropka');
  });
});

describe('clampTitle', () => {
  it('[AC-DESC-009] cuts at a word boundary within 75 characters', () => {
    const long = 'Czajnik elektryczny stalowy 1,7 l 2200 W z regulacją temperatury i podświetleniem LED srebrny';
    const title = clampTitle(long);
    expect(title.length).toBeLessThanOrEqual(75);
    expect(title.endsWith(' ')).toBe(false);
    expect(long.startsWith(title)).toBe(true);
  });

  it('removes markup and collapses whitespace', () => {
    expect(clampTitle('  <b>Kubek</b>   ceramiczny ')).toBe('Kubek ceramiczny');
  });
});

describe('normalizeKeywords', () => {
  it('[AC-DESC-010] lowercases, dedupes and caps the list', () => {
    expect(normalizeKeywords(['Kubek', 'kubek ', '<b>ceramiczny</b>', 42, ''])).toEqual(['kubek', 'ceramiczny']);
    expect(normalizeKeywords(Array.from({ length: 30 }, (_, i) => `k${i}`))).toHaveLength(20);
    expect(normalizeKeywords('nope')).toEqual([]);
  });
});
