import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GeminiService } from './gemini.service';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [ImagesModule],
  controllers: [GenerationController],
  providers: [GenerationService, GeminiService],
})
export class GenerationModule {}
