import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { DemoService } from './demo.service';
import { CreateDemoDto } from './demo.dto';
import { imageMimeFilter, MAX_UPLOAD_BYTES, validateImageBuffer } from '../images/image-validation';
import { UploadedImageFile } from '../types/uploaded-file';

/** Public, unauthenticated "try it" endpoint used by the landing page. */
@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(private demoService: DemoService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Generate one free sample graphic without an account (lead capture)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: imageMimeFilter,
    }),
  )
  async create(
    @Body() dto: CreateDemoDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: ExpressRequest,
  ) {
    if (!file) throw new BadRequestException('Nie przesłano zdjęcia');
    const validated = await validateImageBuffer(file.buffer);
    return this.demoService.create({
      email: dto.email,
      ip: req.ip || req.socket?.remoteAddress || 'unknown',
      buffer: file.buffer,
      mimeType: validated.mimeType,
      styleId: dto.style || 'white-bg',
      marketingOk: dto.marketingOk === true,
      honeypot: dto.website,
    });
  }

  @Get(':id')
  @SkipThrottle()
  @ApiOperation({ summary: 'Poll the status/result of a demo generation' })
  async get(@Param('id') id: string) {
    return this.demoService.get(id);
  }
}
