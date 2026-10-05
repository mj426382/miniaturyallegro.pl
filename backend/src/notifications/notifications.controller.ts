import { Body, Controller, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MAX_BATCH_IMAGES, MIN_BATCH_IMAGES, NotificationsService } from './notifications.service';

class RegisterBatchDto {
  @IsArray()
  @ArrayMinSize(MIN_BATCH_IMAGES, { message: `Paczka musi mieć co najmniej ${MIN_BATCH_IMAGES} zdjęcia` })
  @ArrayMaxSize(MAX_BATCH_IMAGES)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  imageIds: string[];
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Post('batches')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'E-mail me when every graphic of these photos is finished (bulk upload, >= 3 photos)' })
  registerBatch(@CurrentUser() user: SessionUser, @Body() dto: RegisterBatchDto) {
    return this.notifications.registerBatch(user.userId, dto.imageIds);
  }

  /**
   * Public: the link from a marketing e-mail and the RFC 8058 one-click POST (form body
   * `List-Unsubscribe=One-Click`, ignored) both land here. The token is the only credential.
   */
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Withdraw marketing consent with the token from an e-mail (no session needed)' })
  unsubscribe(@Query('token') token: string) {
    return this.notifications.unsubscribe(token);
  }
}
