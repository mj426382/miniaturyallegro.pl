import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DescriptionsService } from './descriptions.service';
import { CreateDescriptionDto, RefineDescriptionDto, UpdateDescriptionDto } from './descriptions.dto';

@ApiTags('descriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('descriptions')
export class DescriptionsController {
  constructor(private descriptions: DescriptionsService) {}

  @Get(':imageId')
  @ApiOperation({ summary: 'Offer copy (title, HTML description, keywords) attached to an uploaded photo' })
  get(@Param('imageId') imageId: string, @CurrentUser() user: SessionUser) {
    return this.descriptions.get(imageId, user.userId);
  }

  @Post(':imageId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Write the offer copy from the seller notes – free bonus of a finished graphic; writing again spends a prompt edit',
  })
  create(@Param('imageId') imageId: string, @Body() dto: CreateDescriptionDto, @CurrentUser() user: SessionUser) {
    return this.descriptions.create(imageId, user.userId, dto);
  }

  @Patch(':imageId')
  @ApiOperation({ summary: 'Manual edit of the offer copy (unlimited, sanitized to Allegro HTML)' })
  update(@Param('imageId') imageId: string, @Body() dto: UpdateDescriptionDto, @CurrentUser() user: SessionUser) {
    return this.descriptions.update(imageId, user.userId, dto);
  }

  @Post(':imageId/refine')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'AI rewrite following an instruction – spends one prompt edit (5 free per photo, then packs)',
  })
  refine(@Param('imageId') imageId: string, @Body() dto: RefineDescriptionDto, @CurrentUser() user: SessionUser) {
    return this.descriptions.refine(imageId, user.userId, dto);
  }

  @Post(':imageId/edit-packs')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Buy a pack of 15 prompt edits for this photo (1 credit)' })
  buyEditPack(@Param('imageId') imageId: string, @CurrentUser() user: SessionUser) {
    return this.descriptions.buyEditPack(imageId, user.userId);
  }
}
