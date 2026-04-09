import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  Response,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerationService } from './generation.service';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { memoryStorage } from 'multer';

export class CustomGenerationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  userPrompt: string;
}

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
  async startGeneration(
    @Param('imageId') imageId: string,
    @Body('basePrompt') basePrompt: string | undefined,
    @Request() req: any,
  ) {
    return this.generationService.startGeneration(imageId, req.user.userId, basePrompt || undefined);
  }

  @Post(':imageId/custom')
  @ApiOperation({ summary: 'Generate a single custom image from user prompt + optional reference image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('reference', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return cb(new Error('Only image files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async startCustomGeneration(
    @Param('imageId') imageId: string,
    @Body('userPrompt') userPrompt: string,
    @Body('isRework') isRework: string,
    @UploadedFile() referenceFile: any,
    @Request() req: any,
  ) {
    return this.generationService.startCustomGeneration(
      imageId,
      req.user.userId,
      userPrompt,
      referenceFile ? referenceFile.buffer : undefined,
      referenceFile ? referenceFile.mimetype : undefined,
      isRework === 'true',
    );
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download a generated image (proxy to avoid CORS)' })
  async downloadGeneration(
    @Param('id') id: string,
    @Request() req: any,
    @Response() res: any,
  ) {
    const { buffer, contentType, style } = await this.generationService.getGenerationForDownload(id, req.user.userId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="miniaturka-${style}.png"`);
    res.send(buffer);
  }

  @Get(':imageId/results')
  @ApiOperation({ summary: 'Get generation results for an image' })
  async getGenerations(
    @Param('imageId') imageId: string,
    @Request() req: any,
  ) {
    return this.generationService.getGenerations(imageId, req.user.userId);
  }

  @Get('result/:id')
  @ApiOperation({ summary: 'Get a single generation result' })
  async getGeneration(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.generationService.getGenerationById(id, req.user.userId);
  }
}
