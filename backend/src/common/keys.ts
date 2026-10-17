import { createHmac, hkdfSync } from 'crypto';

/**
 * Purpose-specific keys (spec 01, NFR-SEC-008).
 *
 * Every secret use besides the session JWT gets its own key, so a token or hash made for one purpose
 * can never be verified or reproduced as another one, and a leak of one derived key does not expose
 * JWT_SECRET. The key is HKDF-SHA256 over JWT_SECRET with a distinct label – or over a dedicated env
 * variable when the operator sets one (useful to rotate JWT_SECRET without touching the others).
 *
 * Changing a label (or the dedicated secret) invalidates everything made with the old key: unsubscribe
 * links stop working, demo IP hashes and account tombstones stop matching. Bump the label version only
 * on purpose.
 */
export const KEY_PURPOSES = {
  /** Spec 16: e-mail unsubscribe links (JWT, HS256). */
  'unsubscribe-token': { label: 'allgrafika:unsubscribe-token:v1', env: 'UNSUBSCRIBE_TOKEN_SECRET' },
  /** Landing demo: per-IP daily limit without storing the IP. */
  'demo-ip-hash': { label: 'allgrafika:demo-ip-hash:v1', env: 'DEMO_IP_HASH_SECRET' },
  /** Spec 03: hash of a deleted account's canonical e-mail. */
  'account-tombstone': { label: 'allgrafika:account-tombstone:v1', env: 'ACCOUNT_TOMBSTONE_SECRET' },
} as const;

export type KeyPurpose = keyof typeof KEY_PURPOSES;

/** Dedicated secrets that may replace the derivation from JWT_SECRET (validated at start-up). */
export const DEDICATED_SECRET_ENV_VARS = Object.values(KEY_PURPOSES).map((p) => p.env);

const HKDF_SALT = 'allgrafika-purpose-keys';
const KEY_BYTES = 32;

type EnvSource = { get<T = string>(key: string): T | undefined } | Record<string, unknown>;

function read(env: EnvSource, key: string): string | undefined {
  const value =
    typeof (env as { get?: unknown }).get === 'function'
      ? (env as { get(key: string): unknown }).get(key)
      : (env as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** 32-byte key for `purpose`, from its dedicated env variable or else from JWT_SECRET. */
export function derivePurposeKey(purpose: KeyPurpose, env: EnvSource): Buffer {
  const { label, env: dedicated } = KEY_PURPOSES[purpose];
  const material = read(env, dedicated) ?? read(env, 'JWT_SECRET');
  if (!material) throw new Error(`Cannot derive the ${purpose} key: JWT_SECRET is not set`);
  // The label also goes through HKDF for a dedicated secret, so reusing one value for two purposes
  // still yields two different keys.
  return Buffer.from(hkdfSync('sha256', material, HKDF_SALT, label, KEY_BYTES));
}

/** Hex HMAC-SHA256 of `value` – for lookups of data we must not keep in plain form. */
export function keyedHash(key: Buffer, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}
