import { createHash } from 'crypto';
import { DEDICATED_SECRET_ENV_VARS, KEY_PURPOSES, KeyPurpose, derivePurposeKey, keyedHash } from './keys';

const JWT_SECRET = 'test-jwt-secret-that-is-long-enough-for-validation-123456';

describe('purpose keys (spec 01, NFR-SEC-008)', () => {
  const purposes = Object.keys(KEY_PURPOSES) as KeyPurpose[];

  it('[AC-SEC-012] derives a deterministic 32-byte key per purpose, different from each other and from JWT_SECRET', () => {
    const keys = purposes.map((p) => derivePurposeKey(p, { JWT_SECRET }));
    for (const key of keys) {
      expect(key).toHaveLength(32);
      expect(key.toString('utf8')).not.toContain(JWT_SECRET);
      expect(key.equals(Buffer.from(JWT_SECRET))).toBe(false);
    }
    expect(new Set(keys.map((k) => k.toString('hex'))).size).toBe(purposes.length);
    // Deterministic: the same secret always gives the same key (hashes keep matching across restarts).
    expect(
      derivePurposeKey('account-tombstone', { JWT_SECRET }).equals(keys[purposes.indexOf('account-tombstone')]),
    ).toBe(true);
    // A different JWT_SECRET gives different keys.
    expect(derivePurposeKey('unsubscribe-token', { JWT_SECRET: `${JWT_SECRET}x` }).equals(keys[0])).toBe(false);
  });

  it('[AC-SEC-012] a dedicated secret replaces the derivation; one value reused for two purposes still yields two keys', () => {
    const shared = 'dedicated-secret-for-tests-0123456789abcdef';
    expect(DEDICATED_SECRET_ENV_VARS).toEqual([
      'UNSUBSCRIBE_TOKEN_SECRET',
      'DEMO_IP_HASH_SECRET',
      'ACCOUNT_TOMBSTONE_SECRET',
    ]);
    const derived = derivePurposeKey('demo-ip-hash', { JWT_SECRET });
    const dedicated = derivePurposeKey('demo-ip-hash', { JWT_SECRET, DEMO_IP_HASH_SECRET: shared });
    expect(dedicated.equals(derived)).toBe(false);
    // Independent of JWT_SECRET once set (rotating JWT_SECRET keeps these hashes valid).
    expect(
      derivePurposeKey('demo-ip-hash', { JWT_SECRET: 'other', DEMO_IP_HASH_SECRET: shared }).equals(dedicated),
    ).toBe(true);
    const tomb = derivePurposeKey('account-tombstone', { JWT_SECRET, ACCOUNT_TOMBSTONE_SECRET: shared });
    expect(tomb.equals(dedicated)).toBe(false);
    // Works with ConfigService-like sources too.
    const config = { get: (k: string) => ({ JWT_SECRET, DEMO_IP_HASH_SECRET: shared })[k] };
    expect(derivePurposeKey('demo-ip-hash', config).equals(dedicated)).toBe(true);
  });

  it('[AC-SEC-012] refuses to derive without a secret and a keyed hash is not a plain hash of the value', () => {
    expect(() => derivePurposeKey('unsubscribe-token', {})).toThrow(/JWT_SECRET/);
    const key = derivePurposeKey('account-tombstone', { JWT_SECRET });
    const value = 'jankowalski@gmail.com';
    const hash = keyedHash(key, value);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(keyedHash(key, value));
    expect(hash).not.toBe(createHash('sha256').update(value).digest('hex'));
    expect(hash).not.toBe(keyedHash(derivePurposeKey('demo-ip-hash', { JWT_SECRET }), value));
  });
});
