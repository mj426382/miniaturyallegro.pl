import { Controller, Post, Get, Param, Body, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Response as ExpressResponse } from 'express';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerationService } from './generation.service';
import { CustomGenerationDto, StartGenerationDto } from './generation.dto';
import { ExportDto, FeedbackDto, InfographicDto, ZipDto } from './feedback.dto';
import { INFOGRAPHIC_ICONS } from './infographic.service';
import { ZipService } from './zip.service';
import { imageMimeFilter, MAX_UPLOAD_BYTES, validateImageBuffer } from '../images/image-validation';
import { UploadedImageFile } from '../types/uploaded-file';

@ApiTags('generation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('generation')
export class GenerationController {
  constructor(
    private generationService: GenerationService,
    private zipService: ZipService,
  ) {}

  @Get('styles')
  @ApiOperation({ summary: 'Available styles and the default (starter) batch' })
  getStyles() {
    return this.generationService.getStyles();
  }

  @Post(':imageId/start')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Start generating the selected styles (default: starter batch of 3)' })
  async startGeneration(
    @Param('imageId') imageId: string,
    @Body() dto: StartGenerationDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.generationService.startGeneration(imageId, user.userId, {
      styleIds: dto.styles,
      basePrompt: dto.basePrompt || undefined,
    });
  }

  @Post(':imageId/custom')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate a single custom image from user prompt + optional reference image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('reference', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: imageMimeFilter,
    }),
  )
  async startCustomGeneration(
    @Param('imageId') imageId: string,
    @Body() dto: CustomGenerationDto,
    @UploadedFile() referenceFile: UploadedImageFile | undefined,
    @CurrentUser() user: SessionUser,
  ) {
    let referenceMime: string | undefined;
    if (referenceFile) {
      referenceMime = (await validateImageBuffer(referenceFile.buffer)).mimeType;
    }
    return this.generationService.startCustomGeneration(
      imageId,
      user.userId,
      dto.userPrompt,
      referenceFile?.buffer,
      referenceMime,
      dto.isRework === true,
    );
  }

  @Post('retry/:id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Retry a failed generation (costs 1 credit)' })
  async retryGeneration(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.generationService.retryGeneration(id, user.userId);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download a generated image (proxy to avoid CORS)' })
  async downloadGeneration(@Param('id') id: string, @CurrentUser() user: SessionUser, @Res() res: ExpressResponse) {
    const { buffer, contentType, style } = await this.generationService.getGenerationForDownload(id, user.userId);
    const safeStyle = style.replace(/[^a-z0-9-]/gi, '');
    const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="grafika-${safeStyle}.${ext}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }

  @Post('feedback/:id')
  @ApiOperation({ summary: 'Rate a finished graphic (thumbs up/down + reason)' })
  async submitFeedback(@Param('id') id: string, @Body() dto: FeedbackDto, @CurrentUser() user: SessionUser) {
    return this.generationService.submitFeedback(id, user.userId, dto.rating, dto.reason, dto.comment);
  }

  @Post('export/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Export a finished graphic in a marketplace format (ratio, size, promo badge)' })
  async exportGeneration(
    @Param('id') id: string,
    @Body() dto: ExportDto,
    @CurrentUser() user: SessionUser,
    @Res() res: ExpressResponse,
  ) {
    const { buffer, contentType, extension, style } = await this.generationService.exportGeneration(
      id,
      user.userId,
      dto,
    );
    const safeStyle = style.replace(/[^a-z0-9-]/gi, '');
    const ratio = (dto.ratio ?? '1:1').replace(':', 'x');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="grafika-${safeStyle}-${ratio}.${extension}"`);
    res.send(buffer);
  }

  @Get('infographic-icons')
  @ApiOperation({ summary: 'Icons available for infographic features' })
  getInfographicIcons() {
    return Object.entries(INFOGRAPHIC_ICONS).map(([id, icon]) => ({ id, name: icon.name }));
  }

  @Post('infographic/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Render a free infographic (features or dimensions) from a finished graphic' })
  async renderInfographic(
    @Param('id') id: string,
    @Body() dto: InfographicDto,
    @CurrentUser() user: SessionUser,
    @Res() res: ExpressResponse,
  ) {
    const { buffer, contentType, extension, style } = await this.generationService.renderInfographic(
      id,
      user.userId,
      dto,
    );
    const safeStyle = style.replace(/[^a-z0-9-]/gi, '');
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="infografika-${dto.template}-${safeStyle}.${extension}"`,
    );
    res.send(buffer);
  }

  @Post('zip')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Download finished graphics and offer descriptions of the given photos as one ZIP' })
  async downloadZip(@Body() dto: ZipDto, @CurrentUser() user: SessionUser, @Res() res: ExpressResponse) {
    // Validation and ownership are checked before any byte is sent, so errors still come back as JSON.
    const plan = await this.zipService.plan(user.userId, dto.imageIds);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="allgrafika-${date}.zip"`);
    res.setHeader('Cache-Control', 'no-store');
    await this.zipService.stream(plan, res);
  }

  @Get(':imageId/results')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get generation results for an image (polled by the UI)' })
  async getGenerations(@Param('imageId') imageId: string, @CurrentUser() user: SessionUser) {
    return this.generationService.getGenerations(imageId, user.userId);
  }

  @Get('result/:id')
  @ApiOperation({ summary: 'Get a single generation result' })
  async getGeneration(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.generationService.getGenerationById(id, user.userId);
  }
}
