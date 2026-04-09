import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImagesService } from './images.service';
import { memoryStorage } from 'multer';

@ApiTags('images')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('images')
export class ImagesController {
  constructor(private imagesService: ImagesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a product image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@Request() req: any, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.imagesService.uploadImage(req.user.userId, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get user images' })
  async getUserImages(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.imagesService.getUserImages(req.user.userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get image by ID' })
  async getImage(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.imagesService.getImageById(id, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an image' })
  async deleteImage(@Param('id') id: string, @Request() req: any) {
    return this.imagesService.deleteImage(id, req.user.userId);
  }
}
