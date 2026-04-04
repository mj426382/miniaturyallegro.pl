import {
  Controller,
  Post,
  Get,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerationService } from './generation.service';

@ApiTags('generation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('generation')
export class GenerationController {
  constructor(private generationService: GenerationService) {}

  @Get('styles')
  @ApiOperation({ summary: 'Get available generation styles' })
  async getStyles() {
    return this.generationService.getStyles();
  }

  @Post(':imageId/start')
  @ApiOperation({ summary: 'Start generating 12 image variants' })
  async startGeneration(@Param('imageId') imageId: string, @Request() req: any) {
    return this.generationService.startGeneration(imageId, req.user.userId);
  }

  @Get(':imageId/results')
  @ApiOperation({ summary: 'Get generation results for an image' })
  async getGenerations(@Param('imageId') imageId: string, @Request() req: any) {
    return this.generationService.getGenerations(imageId, req.user.userId);
  }

  @Get('result/:id')
  @ApiOperation({ summary: 'Get a single generation result' })
  async getGeneration(@Param('id') id: string, @Request() req: any) {
    return this.generationService.getGenerationById(id, req.user.userId);
  }
}
