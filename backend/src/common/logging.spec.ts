import { redactUrl } from './logging';

describe('redactUrl', () => {
  it('[AC-SEC-010] hides secret query values and keeps the rest of the address', () => {
    expect(redactUrl('/api/notifications/unsubscribe?token=eyJhbGciOi.abc.def')).toBe(
      '/api/notifications/unsubscribe?token=[redacted]',
    );
    expect(redactUrl('/api/x?page=2&code=abc&state=xyz&limit=5')).toBe(
      '/api/x?page=2&code=[redacted]&state=[redacted]&limit=5',
    );
    expect(redactUrl('/api/images?page=1&limit=20')).toBe('/api/images?page=1&limit=20');
    expect(redactUrl(undefined)).toBeUndefined();
  });
});
