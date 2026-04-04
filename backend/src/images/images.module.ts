import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [ImagesController],
  providers: [ImagesService, StorageService],
  exports: [ImagesService, StorageService],
})
export class ImagesModule {}
