import { Module } from '@nestjs/common';
import { AllegroController } from './allegro.controller';
import { AllegroService } from './allegro.service';
import { ImagesModule } from '../images/images.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ImagesModule, AuthModule],
  controllers: [AllegroController],
  providers: [AllegroService],
  exports: [AllegroService],
})
export class AllegroModule {}
