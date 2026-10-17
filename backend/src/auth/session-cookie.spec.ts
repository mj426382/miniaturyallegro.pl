import type { Request } from 'express';
import { mayReceiveTokenInBody, withBodyToken } from './session-cookie';

function req(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('token in the auth response body (spec 03 / 18)', () => {
  it('[AC-AUTH-028] only native app origins and non-browser clients may receive the token', () => {
    // Android and iOS app (spec 18) – the WebView sets the Origin, a web page cannot.
    expect(mayReceiveTokenInBody(req({ origin: 'https://native.allgrafika.pl' }))).toBe(true);
    expect(mayReceiveTokenInBody(req({ origin: 'capacitor://native.allgrafika.pl' }))).toBe(true);
    expect(mayReceiveTokenInBody(req({ origin: 'CAPACITOR://NATIVE.ALLGRAFIKA.PL/' }))).toBe(true);
    // Scripts, server integrations, tests: no Origin, no fetch metadata.
    expect(mayReceiveTokenInBody(req({}))).toBe(true);
    expect(mayReceiveTokenInBody(req({ 'user-agent': 'curl/8' }))).toBe(true);

    // Every browser page – our own web app included – relies on the httpOnly cookie.
    for (const origin of [
      'https://app.allgrafika.pl',
      'https://allgrafika.pl',
      'http://localhost:5173',
      'https://evil.example',
      'https://native.allgrafika.pl.evil.example',
      'null',
    ]) {
      expect(mayReceiveTokenInBody(req({ origin }))).toBe(false);
    }
    // A browser that omitted Origin is still recognised by its fetch metadata.
    expect(mayReceiveTokenInBody(req({ 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' }))).toBe(false);
    // A spoofed app header without the app Origin changes nothing.
    expect(mayReceiveTokenInBody(req({ origin: 'https://app.allgrafika.pl', 'x-allgrafika-client': 'native' }))).toBe(
      false,
    );
  });

  it('[AC-AUTH-028] strips only the token and keeps the rest of the response', () => {
    const result = { user: { id: 'u1' }, token: 'jwt', message: 'ok' };
    expect(withBodyToken(req({ origin: 'https://app.allgrafika.pl' }), result)).toEqual({
      user: { id: 'u1' },
      message: 'ok',
    });
    expect(withBodyToken(req({ origin: 'capacitor://native.allgrafika.pl' }), result)).toEqual(result);
  });
});
