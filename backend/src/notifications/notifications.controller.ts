import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MAX_BATCH_IMAGES, MIN_BATCH_IMAGES, NotificationsService } from './notifications.service';

class RegisterBatchDto {
  @IsArray()
  @ArrayMinSize(MIN_BATCH_IMAGES, { message: `Powiadomienie obejmuje co najmniej ${MIN_BATCH_IMAGES} zdjęcia` })
  @ArrayMaxSize(MAX_BATCH_IMAGES)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  imageIds: string[];
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

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

  /**
   * Spec 16, AC-NOT-009: a mail client that follows the List-Unsubscribe URL with GET lands on the app's
   * unsubscribe page (which confirms with POST). GET never changes anything – link scanners prefetch it.
   */
  @Get('unsubscribe')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Redirects a GET on the List-Unsubscribe URL to the app page that confirms it' })
  unsubscribePage(@Query('token') token: string | undefined, @Res() res: Response) {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
    res.redirect(302, `${frontendUrl}/unsubscribe?token=${encodeURIComponent(String(token ?? ''))}`);
  }
}
