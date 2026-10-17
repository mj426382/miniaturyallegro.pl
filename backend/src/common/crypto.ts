import { createHash } from 'crypto';

/** Deterministic SHA-256 hex digest for values compared without keeping the original. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
