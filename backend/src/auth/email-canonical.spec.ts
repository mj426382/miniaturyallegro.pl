import { canonicalEmail } from './email-canonical';
import { CANONICAL_CASES } from './email-canonical.cases';

describe('canonicalEmail', () => {
  it('[AC-VER-001] lower-cases, merges googlemail, drops +aliases everywhere and dots only in Gmail', () => {
    for (const [input, expected] of CANONICAL_CASES) {
      expect({ input, out: canonicalEmail(input) }).toEqual({ input, out: expected });
    }
  });

  it('[AC-VER-001] never leaves an empty local part', () => {
    expect(canonicalEmail('+@x.pl')).toBe('+@x.pl');
    expect(canonicalEmail('.@gmail.com')).toBe('.@gmail.com');
  });
});
