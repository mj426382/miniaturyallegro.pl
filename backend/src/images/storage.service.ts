import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class StorageService {
  private s3: AWS.S3 | null = null;
  private bucketName: string;
  private publicUrl: string;
  private useLocal: boolean;
  private localUploadDir: string;
  private readonly logger = new Logger(StorageService.name);

  /** Cache: key -> { url, expiresAt } */
  private readonly urlCache = new Map<string, { url: string; expiresAt: number }>();
  private readonly URL_TTL_SECONDS = 23 * 60 * 60; // 23 hours

  constructor(private configService: ConfigService) {
    this.bucketName = configService.get<string>('B2_BUCKET_NAME') || '';
    this.publicUrl = configService.get<string>('B2_PUBLIC_URL') || '';
    this.localUploadDir = '/app/uploads';

    const hasB2Config =
      !!this.bucketName &&
      !!configService.get<string>('B2_ENDPOINT') &&
      !!configService.get<string>('B2_KEY_ID') &&
      !!configService.get<string>('B2_APPLICATION_KEY');

    if (hasB2Config) {
      this.useLocal = false;
      this.s3 = new AWS.S3({
        endpoint: configService.get<string>('B2_ENDPOINT'),
        accessKeyId: configService.get<string>('B2_KEY_ID'),
        secretAccessKey: configService.get<string>('B2_APPLICATION_KEY'),
        region: configService.get<string>('B2_REGION') || 'us-west-004',
        signatureVersion: 'v4',
        s3ForcePathStyle: true,
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
    const filename = `${folder}/${uuidv4()}${ext}`;

    if (this.useLocal) {
      const dir = path.join(this.localUploadDir, folder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(this.localUploadDir, filename), buffer);
      // For local storage the URL is the static path (served by NestJS)
      return { url: `/api/uploads/${filename}`, filename };
    }

    await this.s3!
      .putObject({
        Bucket: this.bucketName,
        Key: filename,
        Body: buffer,
        ContentType: mimeType,
      })
      .promise();

    // Store just the key — presigned URLs are generated on demand
    return { url: filename, filename };
  }

  /**
   * Generate a presigned GET URL cached for URL_TTL_SECONDS.
   * Stable URL across requests = browser can cache the image itself.
   */
  getSignedUrl(key: string): string {
    if (this.useLocal || key.startsWith('/') || key.startsWith('http')) {
      return key;
    }

    const now = Date.now();
    const cached = this.urlCache.get(key);
    if (cached && cached.expiresAt > now + 60_000) {
      return cached.url;
    }

    const url = this.s3!.getSignedUrl('getObject', {
      Bucket: this.bucketName,
      Key: key,
      Expires: this.URL_TTL_SECONDS,
    });

    this.urlCache.set(key, { url, expiresAt: now + this.URL_TTL_SECONDS * 1000 });
    return url;
  }

  /** Invalidate cached URL for a key (call after delete) */
  invalidateCachedUrl(key: string): void {
    this.urlCache.delete(key);
  }

  async deleteFile(filename: string): Promise<void> {
    this.invalidateCachedUrl(filename);

    if (this.useLocal) {
      const filePath = path.join(this.localUploadDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    }

    await this.s3!
      .deleteObject({
        Bucket: this.bucketName,
        Key: filename,
      })
      .promise();
  }

  getLocalUploadDir(): string {
    return this.localUploadDir;
  }
}
