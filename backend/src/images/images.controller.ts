import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImagesService } from './images.service';
import { imageMimeFilter, MAX_UPLOAD_BYTES } from './image-validation';
import { UploadedImageFile } from '../types/uploaded-file';

@ApiTags('images')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('images')
export class ImagesController {
  constructor(private imagesService: ImagesService) {}

  @Post('upload')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Upload a product image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: imageMimeFilter,
    }),
  )
  async uploadImage(@CurrentUser() user: SessionUser, @UploadedFile() file: UploadedImageFile | undefined) {
    if (!file) {
      throw new BadRequestException('Nie przesłano pliku');
    }
    return this.imagesService.uploadImage(user.userId, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get user images' })
  async getUserImages(
    @CurrentUser() user: SessionUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.imagesService.getUserImages(user.userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get image by ID' })
  async getImage(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.imagesService.getImageById(id, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an image and all its generations' })
  async deleteImage(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.imagesService.deleteImage(id, user.userId);
  }
}
