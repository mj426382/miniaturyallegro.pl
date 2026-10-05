import { buildCorsOrigins, DEFAULT_CORS_ORIGINS, NATIVE_APP_ORIGINS } from './cors';

describe('CORS origins (spec 18)', () => {
  it('[AC-MOB-007] allows the web domains and both native app origins in production', () => {
    const origins = buildCorsOrigins({ NODE_ENV: 'production' });
    expect(origins).toEqual(expect.arrayContaining([...DEFAULT_CORS_ORIGINS, ...NATIVE_APP_ORIGINS]));
    expect(origins).toContain('capacitor://native.allgrafika.pl');
    expect(origins).toContain('https://native.allgrafika.pl');
  });

  it('[AC-MOB-007] keeps the native origins when CORS_ORIGINS is overridden on the server', () => {
    const origins = buildCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.allgrafika.pl' });
    expect(origins).toEqual(['https://app.allgrafika.pl', ...NATIVE_APP_ORIGINS]);
  });

  it('[AC-MOB-007] rejects localhost and foreign origins in production', () => {
    const origins = buildCorsOrigins({ NODE_ENV: 'production' });
    for (const bad of [
      'https://localhost',
      'capacitor://localhost',
      'http://localhost:5173',
      'https://evil.example.com',
      'https://native.allgrafika.pl.evil.com',
    ]) {
      expect(origins).not.toContain(bad);
    }
  });

  it('[AC-MOB-007] adds the Vite dev servers outside production', () => {
    expect(buildCorsOrigins({ NODE_ENV: 'development' })).toContain('http://localhost:5173');
  });
});
