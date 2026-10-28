import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GeminiService } from './gemini.service';
import { CreditsService } from './credits.service';
import { ExportService } from './export.service';
import { InfographicService } from './infographic.service';
import { ZipService } from './zip.service';
import { ImagesModule } from '../images/images.module';
import { UserStylesController } from './user-styles.controller';
import { UserStylesService } from './user-styles.service';

@Module({
  imports: [ImagesModule],
  controllers: [GenerationController, UserStylesController],
  providers: [
    GenerationService,
    GeminiService,
    CreditsService,
    ExportService,
    InfographicService,
    ZipService,
    UserStylesService,
  ],
  exports: [CreditsService, ExportService, GeminiService],
})
export class GenerationModule {}
