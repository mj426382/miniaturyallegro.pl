import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { StorageService } from './storage.service';
import { UploadQuotaService } from './upload-quota.service';

@Module({
  controllers: [ImagesController],
  providers: [ImagesService, StorageService, UploadQuotaService],
  exports: [ImagesService, StorageService, UploadQuotaService],
})
export class ImagesModule {}
