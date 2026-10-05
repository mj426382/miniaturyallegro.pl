/** Operator addresses from ADMIN_EMAILS (comma separated, case-insensitive). Unset = nobody is an admin. */
export function parseAdminEmails(value: string | undefined): Set<string> {
  return new Set(
    (value || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
