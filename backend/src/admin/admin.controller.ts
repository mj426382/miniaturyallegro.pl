import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

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
