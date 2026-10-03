import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

/**
 * File storage: Backblaze B2 through the S3-compatible API (AWS SDK v3) in production,
 * local disk when B2 is not configured (dev/tests). Keys are stored in the database;
 * presigned GET URLs are produced on demand and cached per key.
 */
/**
 * S3-compatible endpoint as a full URL. Operators often configure just the host
 * (`s3.eu-central-003.backblazeb2.com`); AWS SDK v2 accepted that, v3 throws "Invalid URL".
 */
export function toEndpointUrl(value: string | undefined): string | undefined {
  const v = (value || '').trim();
  if (!v) return undefined;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

@Injectable()
export class StorageService {
  private s3: S3Client | null = null;
  private bucketName: string;
  private publicUrl: string;
  private useLocal: boolean;
  private localUploadDir: string;
  /** Absolute origin of this API for locally stored files (API_PUBLIC_URL), empty = relative URLs. */
  private readonly publicBase: string;
  private readonly logger = new Logger(StorageService.name);

  /** Cache: key -> { url, expiresAt } */
  private readonly urlCache = new Map<string, { url: string; expiresAt: number }>();
  private readonly URL_TTL_SECONDS = 23 * 60 * 60; // 23 hours

  constructor(private configService: ConfigService) {
    this.bucketName = configService.get<string>('B2_BUCKET_NAME') || '';
    this.publicUrl = configService.get<string>('B2_PUBLIC_URL') || '';
    this.localUploadDir = configService.get<string>('LOCAL_UPLOAD_DIR') || '/app/uploads';
    this.publicBase = (configService.get<string>('API_PUBLIC_URL') || '').replace(/\/$/, '');

    const hasB2Config =
      !!this.bucketName &&
      !!configService.get<string>('B2_ENDPOINT') &&
      !!configService.get<string>('B2_KEY_ID') &&
      !!configService.get<string>('B2_APPLICATION_KEY');

    if (hasB2Config) {
      this.useLocal = false;
      this.s3 = new S3Client({
        endpoint: toEndpointUrl(configService.get<string>('B2_ENDPOINT')),
        region: configService.get<string>('B2_REGION') || 'us-west-004',
        credentials: {
          accessKeyId: configService.get<string>('B2_KEY_ID')!,
          secretAccessKey: configService.get<string>('B2_APPLICATION_KEY')!,
        },
        forcePathStyle: true,
      });
      this.logger.log('Storage: using Backblaze B2');
    } else {
      this.useLocal = true;
      if (!fs.existsSync(this.localUploadDir)) {
        fs.mkdirSync(this.localUploadDir, { recursive: true });
      }
      this.logger.warn('B2 not configured — using local disk storage at ' + this.localUploadDir);
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'uploads',
  ): Promise<{ url: string; filename: string }> {
    const ext = path.extname(originalName);
    const filename = `${folder}/${randomUUID()}${ext}`;

    if (this.useLocal) {
      const dir = path.join(this.localUploadDir, folder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(this.localUploadDir, filename), buffer);
      // For local storage the URL is the static path (served by NestJS)
      return { url: `/api/uploads/${filename}`, filename };
    }

    await this.s3!.send(
      new PutObjectCommand({ Bucket: this.bucketName, Key: filename, Body: buffer, ContentType: mimeType }),
    );
    // Store just the key — presigned URLs are generated on demand
    return { url: filename, filename };
  }

  /**
   * Presigned GET URL cached for URL_TTL_SECONDS: a stable URL across requests lets the
   * browser cache the image itself. Local files resolve to the API's static route.
   */
  async getSignedUrl(key: string): Promise<string> {
    if (key.startsWith('http')) return key;
    if (this.useLocal || key.startsWith('/')) {
      // Local-disk files are served by this API; when the SPA runs on another origin
      // (e.g. Vite on :5173 vs API on :3001) the URL must be absolute.
      return key.startsWith('/') && this.publicBase ? `${this.publicBase}${key}` : key;
    }

    const now = Date.now();
    const cached = this.urlCache.get(key);
    if (cached && cached.expiresAt > now + 60_000) {
      return cached.url;
    }

    const url = await presign(this.s3!, new GetObjectCommand({ Bucket: this.bucketName, Key: key }), {
      expiresIn: this.URL_TTL_SECONDS,
    });
    this.urlCache.set(key, { url, expiresAt: now + this.URL_TTL_SECONDS * 1000 });
    return url;
  }

  /** Fetch file content as a Buffer directly from B2 (or local disk). */
  async getFileBuffer(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (this.useLocal || key.startsWith('/')) {
      const filePath = key.startsWith('/')
        ? key.replace(/^\/api\/uploads\//, this.localUploadDir + '/')
        : path.join(this.localUploadDir, key);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const ct = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { buffer, contentType: ct };
    }

    const result = await this.s3!.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
    const bytes = await result.Body!.transformToByteArray();
    return {
      buffer: Buffer.from(bytes),
      contentType: result.ContentType || 'application/octet-stream',
    };
  }

  /** Invalidate cached URL for a key (call after delete) */
  invalidateCachedUrl(key: string): void {
    this.urlCache.delete(key);
  }

  async deleteFile(filename: string): Promise<void> {
    this.invalidateCachedUrl(filename);
    if (this.useLocal || filename.startsWith('/')) {
      const filePath = filename.startsWith('/')
        ? filename.replace(/^\/api\/uploads\//, this.localUploadDir + '/')
        : path.join(this.localUploadDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    }

    await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: filename }));
  }

  getLocalUploadDir(): string {
    return this.localUploadDir;
  }
}
