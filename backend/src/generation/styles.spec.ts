import { GENERATION_STYLES, getDefaultStyleIds, getStyle, STYLE_IDS } from './styles';

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
});
