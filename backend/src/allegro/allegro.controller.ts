import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AllegroService } from './allegro.service';

class CallbackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  state: string;
}

class ListOffersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;
}

class PublishDto {
  @IsString()
  @IsNotEmpty()
  generationId: string;

  @IsOptional()
  @IsIn(['first', 'last'])
  position?: 'first' | 'last';
}

@ApiTags('allegro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('allegro')
export class AllegroController {
  constructor(private allegro: AllegroService) {}

  @Get('status')
  @ApiOperation({ summary: 'Is the integration configured / is this user connected' })
  status(@CurrentUser() user: SessionUser) {
    return this.allegro.getStatus(user.userId);
  }

  @Get('auth-url')
  @ApiOperation({ summary: 'Allegro OAuth authorization URL (redirect the browser there)' })
  authUrl(@CurrentUser() user: SessionUser) {
    return this.allegro.getAuthUrl(user.userId);
  }

  @Post('callback')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Exchange the OAuth code for tokens' })
  callback(@CurrentUser() user: SessionUser, @Body() dto: CallbackDto) {
    return this.allegro.handleCallback(user.userId, dto.code, dto.state);
  }

  @Delete('connection')
  @ApiOperation({ summary: 'Disconnect the Allegro account (deletes stored tokens)' })
  disconnect(@CurrentUser() user: SessionUser) {
    return this.allegro.disconnect(user.userId);
  }

  @Get('offers')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: "List the seller's active offers" })
  offers(@CurrentUser() user: SessionUser, @Query() query: ListOffersQuery) {
    return this.allegro.listOffers(user.userId, query);
  }

  @Post('offers/:offerId/import')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: "Import the offer's main photo as a new product image" })
  importOffer(@CurrentUser() user: SessionUser, @Param('offerId') offerId: string) {
    return this.allegro.importOfferImage(user.userId, offerId);
  }

  @Post('offers/:offerId/publish')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Publish a generated graphic to the offer (as main photo or appended to the gallery)' })
  publish(@CurrentUser() user: SessionUser, @Param('offerId') offerId: string, @Body() dto: PublishDto) {
    return this.allegro.publishGeneration(user.userId, offerId, dto.generationId, dto.position ?? 'first');
  }
}
