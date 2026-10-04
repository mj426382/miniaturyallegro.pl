import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  UseGuards,
  BadRequestException,
  Req,
  RawBodyRequest,
  Param,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { CreateCheckoutDto, CreateSubscriptionDto } from './payments.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get('packages')
  @ApiOperation({ summary: 'Get available one-time credit packages' })
  getPackages() {
    return this.paymentsService.getPackages();
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get monthly subscription plans (available = Stripe price configured)' })
  getPlans() {
    return this.paymentsService.getPlans();
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create Stripe checkout session for a one-time pack' })
  async createCheckout(@CurrentUser() user: SessionUser, @Body() dto: CreateCheckoutDto) {
    return this.paymentsService.createCheckoutSession(user.userId, dto.packageId);
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create Stripe checkout session for a monthly plan' })
  async subscribe(@CurrentUser() user: SessionUser, @Body() dto: CreateSubscriptionDto) {
    return this.paymentsService.createSubscriptionSession(user.userId, dto.planId);
  }

  @Post('portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Stripe billing portal (cancel / change plan / update card)' })
  async portal(@CurrentUser() user: SessionUser) {
    return this.paymentsService.createPortalSession(user.userId);
  }

  @Get('subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current subscription of the user (null when none)' })
  async subscription(@CurrentUser() user: SessionUser) {
    return { subscription: await this.paymentsService.getSubscription(user.userId) };
  }

  @Get('history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment transaction history' })
  async getHistory(@CurrentUser() user: SessionUser) {
    return this.paymentsService.getTransactionHistory(user.userId);
  }

  @Get('invoices/:transactionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Fresh link to the Stripe invoice PDF of an own payment (404 when there is none)' })
  async getInvoice(@CurrentUser() user: SessionUser, @Param('transactionId') transactionId: string) {
    return this.paymentsService.getInvoiceUrl(user.userId, transactionId);
  }

  // Stripe retries webhooks aggressively; the per-IP throttle must not reject them.
  @Post('webhook')
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook endpoint (signature-verified, no JWT)' })
  async handleWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Brak raw body');
    if (!signature) throw new BadRequestException('Brak podpisu webhooka');
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
