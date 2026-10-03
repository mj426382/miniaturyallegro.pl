import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';
import { validateImageBuffer, imageMimeFilter } from './image-validation';

async function solid(format: 'png' | 'jpeg' | 'webp' | 'gif', size = 120): Promise<Buffer> {
  const img = sharp({ create: { width: size, height: size, channels: 3, background: { r: 1, g: 2, b: 3 } } });
  return img.toFormat(format).toBuffer();
}

describe('validateImageBuffer', () => {
  it('[AC-UPL-008] accepts JPEG, PNG and WebP and reports the real format', async () => {
    expect(await validateImageBuffer(await solid('png'))).toMatchObject({
      format: 'png',
      extension: '.png',
      mimeType: 'image/png',
    });
    expect(await validateImageBuffer(await solid('jpeg'))).toMatchObject({ format: 'jpeg', extension: '.jpg' });
    expect(await validateImageBuffer(await solid('webp'))).toMatchObject({ format: 'webp', extension: '.webp' });
  });

  it('[AC-UPL-002] rejects non-images, unsupported formats, empty and tiny files', async () => {
    await expect(validateImageBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).rejects.toThrow(
      BadRequestException,
    );
    await expect(validateImageBuffer(await solid('gif'))).rejects.toThrow(/Nieobsługiwany format/);
    await expect(validateImageBuffer(Buffer.alloc(0))).rejects.toThrow(/pusty/);
    await expect(validateImageBuffer(await solid('png', 50))).rejects.toThrow(/zbyt mały/);
  });
});

describe('imageMimeFilter', () => {
  it('[AC-UPL-007] accepts only image MIME types', () => {
    const cb = jest.fn();
    imageMimeFilter(undefined, { mimetype: 'image/jpeg' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
    imageMimeFilter(undefined, { mimetype: 'text/html' }, cb);
    expect(cb.mock.calls[1][0]).toBeInstanceOf(BadRequestException);
  });
});
