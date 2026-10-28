import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { imageMimeFilter, MAX_UPLOAD_BYTES, validateImageBuffer } from '../images/image-validation';
import { UploadedImageFile } from '../types/uploaded-file';
import { CreateUserStyleDto, UpdateUserStyleDto } from './user-styles.dto';
import { UserStylesService } from './user-styles.service';

const referenceUpload = () =>
  FileInterceptor('reference', {
    storage: memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: imageMimeFilter,
  });

async function validated(file: UploadedImageFile | undefined) {
  if (!file) return undefined;
  return { buffer: file.buffer, mimeType: (await validateImageBuffer(file.buffer)).mimeType };
}

/** Spec 27: the user's saved styles ("Moje style"). */
@ApiTags('user-styles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-styles')
export class UserStylesController {
  constructor(private readonly userStyles: UserStylesService) {}

  @Get()
  @ApiOperation({ summary: 'Saved styles of the current user, newest first' })
  list(@CurrentUser() user: SessionUser) {
    return this.userStyles.list(user.userId);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Save a style: name, Polish scene description and an optional reference photo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(referenceUpload())
  async create(
    @Body() dto: CreateUserStyleDto,
    @UploadedFile() reference: UploadedImageFile | undefined,
    @CurrentUser() user: SessionUser,
  ) {
    return this.userStyles.create(user.userId, { name: dto.name, prompt: dto.prompt }, await validated(reference));
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Edit a saved style (name, description, replace or remove the reference photo)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(referenceUpload())
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserStyleDto,
    @UploadedFile() reference: UploadedImageFile | undefined,
    @CurrentUser() user: SessionUser,
  ) {
    return this.userStyles.update(
      user.userId,
      id,
      { name: dto.name, prompt: dto.prompt, removeReference: dto.removeReference === true },
      await validated(reference),
    );
  }

  @Delete(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete a saved style and its reference photo (finished graphics stay)' })
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.userStyles.remove(user.userId, id);
  }
}
