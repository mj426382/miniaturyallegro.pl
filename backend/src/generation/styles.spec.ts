import { GENERATION_STYLES, getDefaultStyleIds, getStyle, isInSeason, STYLE_IDS } from './styles';
import { buildImagePrompt, PRODUCT_INTEGRITY_CONSTRAINTS } from './gemini.service';

describe('generation styles', () => {
  it('has unique ids and English prompts without product-altering instructions', () => {
    expect(new Set(STYLE_IDS).size).toBe(GENERATION_STYLES.length);
    for (const style of GENERATION_STYLES) {
      expect(style.prompt.length).toBeGreaterThan(80);
      // Prompts must be English – a quick heuristic on Polish diacritics.
      expect(style.prompt).not.toMatch(/[ąćęłńóśźż]/i);
      expect(style.name.length).toBeGreaterThan(0);
    }
  });

  it('defaults to the 3 starter styles', () => {
    expect(getDefaultStyleIds()).toEqual(['white-bg', 'lifestyle-home', 'dark-luxury']);
    expect(getDefaultStyleIds(undefined)).toHaveLength(3);
  });

  it('[AC-GEN-013] accepts an env override and ignores unknown ids', () => {
    expect(getDefaultStyleIds('gradient-bg, bogus ,white-bg')).toEqual(['gradient-bg', 'white-bg']);
    expect(getDefaultStyleIds('bogus')).toEqual(['white-bg', 'lifestyle-home', 'dark-luxury']);
  });

  it('[AC-GEN-012] looks styles up by id', () => {
    expect(getStyle('white-bg')?.name).toBe('Białe tło');
    expect(getStyle('nope')).toBeUndefined();
  });

  it('[AC-GEN-001] has 19 styles: 6 universal (3 starter), 5 seasonal with windows, 8 industry', () => {
    const by = (c: string) => GENERATION_STYLES.filter((s) => s.category === c);
    expect(GENERATION_STYLES).toHaveLength(19);
    expect(by('universal')).toHaveLength(6);
    expect(by('seasonal')).toHaveLength(5);
    expect(by('industry')).toHaveLength(8);
    expect(GENERATION_STYLES.filter((s) => s.starter).map((s) => s.id)).toEqual([
      'white-bg',
      'lifestyle-home',
      'dark-luxury',
    ]);
    for (const s of by('seasonal')) expect(s.season?.from).toMatch(/^\d{2}-\d{2}$/);
    for (const s of [...by('universal'), ...by('industry')]) expect(s.season).toBeUndefined();
  });

  it('[AC-GEN-022] computes the season window, including windows that cross New Year', () => {
    const christmas = getStyle('christmas')!;
    expect(isInSeason(christmas, new Date(2026, 11, 1))).toBe(true);
    expect(isInSeason(christmas, new Date(2026, 11, 24))).toBe(true);
    expect(isInSeason(christmas, new Date(2026, 11, 25))).toBe(false);
    expect(isInSeason(christmas, new Date(2026, 6, 1))).toBe(false);
    const winter = { season: { from: '12-15', to: '01-10' } };
    expect(isInSeason(winter, new Date(2026, 11, 31))).toBe(true);
    expect(isInSeason(winter, new Date(2027, 0, 5))).toBe(true);
    expect(isInSeason(winter, new Date(2027, 0, 11))).toBe(false);
    expect(isInSeason(getStyle('white-bg')!, new Date(2026, 11, 1))).toBe(false);
    expect(isInSeason(getStyle('fashion')!, new Date(2026, 11, 1))).toBe(false);
  });

  it('[AC-GEN-023] seasonal and industry prompts are English, forbid copy and get the integrity rules', () => {
    for (const style of GENERATION_STYLES.filter((s) => s.category !== 'universal')) {
      expect(style.prompt).not.toMatch(/[ąćęłńóśźż]/i);
      expect(style.prompt).toMatch(/Do not add any text, letters, numbers, logos/);
      expect(buildImagePrompt(style.prompt)).toContain(PRODUCT_INTEGRITY_CONSTRAINTS);
    }
  });
});
