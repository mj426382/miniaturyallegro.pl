import { decrypt, deriveKey, encrypt, sha256 } from './crypto';

describe('crypto helpers', () => {
  const key = deriveKey('some-secret');

  it('[AC-ALG-005] round-trips and uses a fresh IV every time', () => {
    const a = encrypt('token-value', key);
    const b = encrypt('token-value', key);
    expect(a).not.toBe(b);
    expect(decrypt(a, key)).toBe('token-value');
    expect(decrypt(b, key)).toBe('token-value');
  });

  it('[AC-ALG-006] fails on a wrong key or tampered payload', () => {
    const payload = encrypt('secret', key);
    expect(() => decrypt(payload, deriveKey('other'))).toThrow();
    const [iv, data, tag] = payload.split('.');
    expect(() => decrypt(`${iv}.${data}.${tag.slice(0, -2)}AA`, key)).toThrow();
  });

  it('[AC-SEC-003] hashes deterministically', () => {
    expect(sha256('a')).toBe(sha256('a'));
    expect(sha256('a')).toHaveLength(64);
  });
});
