import { sha256 } from './crypto';

describe('crypto helpers', () => {
  it('[AC-SEC-003] hashes deterministically', () => {
    expect(sha256('a')).toBe(sha256('a'));
    expect(sha256('a')).toHaveLength(64);
  });
});
