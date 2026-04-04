import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class StorageService {
  private s3: AWS.S3;
  private bucketName: string;
  private publicUrl: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {
    this.bucketName = configService.get<string>('B2_BUCKET_NAME');
    this.publicUrl = configService.get<string>('B2_PUBLIC_URL');

    this.s3 = new AWS.S3({
      endpoint: configService.get<string>('B2_ENDPOINT'),
      accessKeyId: configService.get<string>('B2_KEY_ID'),
      secretAccessKey: configService.get<string>('B2_APPLICATION_KEY'),
      region: configService.get<string>('B2_REGION') || 'us-west-004',
      signatureVersion: 'v4',
      s3ForcePathStyle: true,
    });
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'uploads',
  ): Promise<{ url: string; filename: string }> {
    const ext = path.extname(originalName);
    const filename = `${folder}/${uuidv4()}${ext}`;

    await this.s3
      .putObject({
        Bucket: this.bucketName,
        Key: filename,
        Body: buffer,
        ContentType: mimeType,
      })
      .promise();

    const url = `${this.publicUrl}/${filename}`;
    return { url, filename };
  }

  async deleteFile(filename: string): Promise<void> {
    await this.s3
      .deleteObject({
        Bucket: this.bucketName,
        Key: filename,
      })
      .promise();
  }
}
