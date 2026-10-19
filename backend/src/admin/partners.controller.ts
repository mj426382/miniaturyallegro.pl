import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { PartnersService } from './partners.service';
import {
  CreatePartnerCodeDto,
  CreatePartnerDto,
  CreatePartnerPayoutDto,
  LinkPartnerCodeDto,
  UpdatePartnerDto,
} from './partners.dto';

/** Spec 24: the partner (affiliate) programme in the admin panel – administrators only (AC-PRT-013). */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/partners')
export class PartnersController {
  constructor(private partners: PartnersService) {}

  @Get()
  @ApiOperation({ summary: 'Partners with codes, customers, current-month and all-time commission and balance' })
  list() {
    return this.partners.list();
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a partner – optionally with its percent discount code (Stripe) in one step' })
  create(@CurrentUser() admin: SessionUser, @Body() dto: CreatePartnerDto) {
    return this.partners.create(admin.email, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'A partner with the monthly statement (Europe/Warsaw, masked customers) and payouts' })
  detail(@Param('id') id: string) {
    return this.partners.detail(id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Edit a partner (rates and period apply to later payments and attributions)' })
  update(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.partners.update(id, dto);
  }

  @Post(':id/codes')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Create another discount code for the partner (percent = the partner's discount)" })
  createCode(@CurrentUser() admin: SessionUser, @Param('id') id: string, @Body() dto: CreatePartnerCodeDto) {
    return this.partners.createCode(admin.email, id, dto);
  }

  @Post(':id/codes/link')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Link an existing discount code to the partner' })
  linkCode(@Param('id') id: string, @Body() dto: LinkPartnerCodeDto) {
    return this.partners.linkCode(id, dto);
  }

  @Post(':id/codes/:codeId/unlink')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Unlink a discount code from the partner (later payments do not attribute)' })
  unlinkCode(@Param('id') id: string, @Param('codeId') codeId: string) {
    return this.partners.unlinkCode(id, codeId);
  }

  @Post(':id/payouts')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Record a payout to the partner (reduces the unpaid balance; warnings below 50 zł)' })
  recordPayout(@CurrentUser() admin: SessionUser, @Param('id') id: string, @Body() dto: CreatePartnerPayoutDto) {
    return this.partners.recordPayout(admin.email, id, dto);
  }
}
