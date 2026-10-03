import { toEndpointUrl } from './storage.service';

describe('toEndpointUrl', () => {
  it('[AC-UPL-018] prepends https:// when the operator configured only the host', () => {
    expect(toEndpointUrl('s3.eu-central-003.backblazeb2.com')).toBe('https://s3.eu-central-003.backblazeb2.com');
    expect(toEndpointUrl('  s3.eu-central-003.backblazeb2.com ')).toBe('https://s3.eu-central-003.backblazeb2.com');
  });

  it('[AC-UPL-018] keeps a full URL untouched and treats empty as not configured', () => {
    expect(toEndpointUrl('https://s3.us-west-004.backblazeb2.com')).toBe('https://s3.us-west-004.backblazeb2.com');
    expect(toEndpointUrl('http://localhost:9000')).toBe('http://localhost:9000');
    expect(toEndpointUrl('')).toBeUndefined();
    expect(toEndpointUrl(undefined)).toBeUndefined();
  });
});
