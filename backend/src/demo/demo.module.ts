import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { ImagesModule } from '../images/images.module';
import { GenerationModule } from '../generation/generation.module';

@Module({
  imports: [ImagesModule, GenerationModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
