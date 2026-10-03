import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module';
import { DescriptionsController } from './descriptions.controller';
import { DescriptionsService } from './descriptions.service';

@Module({
  imports: [GenerationModule],
  controllers: [DescriptionsController],
  providers: [DescriptionsService],
})
export class DescriptionsModule {}
