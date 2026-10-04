/**
 * Canonical form of an e-mail address used to detect "the same mailbox" (spec 13, FR-AUTH-002).
 *
 * - trimmed and lower-cased,
 * - `googlemail.com` is the same mailbox as `gmail.com`,
 * - everything from the first `+` in the local part is an alias tag and is dropped (unless the
 *   local part would become empty),
 * - Gmail ignores dots in the local part.
 *
 * The SQL function `allgrafika_email_canonical` (migration 20261004090000) mirrors this exactly and
 * a test keeps the two in sync – change both together.
 */
export function canonicalEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return email;

  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';

  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);

  if (domain === 'gmail.com') {
    const withoutDots = local.replace(/\./g, '');
    if (withoutDots) local = withoutDots;
  }
  return `${local}@${domain}`;
}
