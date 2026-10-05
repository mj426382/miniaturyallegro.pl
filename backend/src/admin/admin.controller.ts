import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type, Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { GenerationStatus } from '@prisma/client';
import { ADMIN_RATING_FILTERS, AdminContentService, AdminRatingFilter } from './admin-content.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminUsersService } from './admin-users.service';

class ListUsersQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(96)
  limit?: number;
}

class GenerationsQuery extends PageQuery {
  @IsOptional()
  @IsIn(Object.values(GenerationStatus), { message: 'Nieznany status' })
  status?: GenerationStatus;

  @IsOptional()
  @IsIn(ADMIN_RATING_FILTERS, { message: 'Filtr oceny: up, down albo rated' })
  rating?: AdminRatingFilter;
}

class AdminEmailDto {
  @IsString()
  @MinLength(3, { message: 'Temat jest za krótki' })
  @MaxLength(150, { message: 'Temat może mieć maksymalnie 150 znaków' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  subject: string;

  @IsString()
  @MinLength(10, { message: 'Treść jest za krótka' })
  @MaxLength(5000, { message: 'Treść może mieć maksymalnie 5000 znaków' })
  message: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private admin: AdminService,
    private users: AdminUsersService,
    private content: AdminContentService,
  ) {}

  @Get('users/:id/images')
  @ApiOperation({ summary: "A user's photos with all their graphics (signed links); every view is logged" })
  userImages(@CurrentUser() admin: SessionUser, @Param('id') id: string, @Query() query: PageQuery) {
    return this.content.userImages(admin.email, id, query.page, query.limit);
  }

  @Get('generations')
  @ApiOperation({ summary: 'Latest graphics of all users, filterable by status and rating (quality review)' })
  generations(@CurrentUser() admin: SessionUser, @Query() query: GenerationsQuery) {
    return this.content.recentGenerations(admin.email, query);
  }

  @Get('users')
  @ApiOperation({ summary: 'Accounts with usage, plan, credits and consent (search by e-mail or name)' })
  listUsers(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'One account with payments and the history of e-mails sent to it' })
  userDetail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Post('users/:id/email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Send an individual message to the user (Reply-To: the admin)' })
  sendEmail(@CurrentUser() admin: SessionUser, @Param('id') id: string, @Body() dto: AdminEmailDto) {
    return this.users.sendEmail(admin.email, id, dto.subject, dto.message);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Operator dashboard: users, generations, stuck jobs, revenue, demo leads' })
  overview() {
    return this.admin.overview();
  }

  @Get('feedback-stats')
  @ApiOperation({ summary: 'Thumbs up/down per style with the most common rejection reasons' })
  feedbackStats() {
    return this.admin.feedbackStats();
  }

  @Get('withdrawal-quote')
  @ApiOperation({ summary: 'Suggested refund for a consumer withdrawing from a subscription (art. 35 u.p.k.)' })
  withdrawalQuote(@Query('email') email: string) {
    return this.admin.withdrawalQuote(email);
  }
}
