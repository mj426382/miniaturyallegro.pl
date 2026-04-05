import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  Req,
  Headers,
  HttpCode,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get('packages')
  @ApiOperation({ summary: 'Get available credit packages' })
  getPackages() {
    return this.paymentsService.getPackages();
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  async createCheckout(
    @Request() req: any,
    @Body('packageId') packageId: string,
  ) {
    if (!packageId) throw new BadRequestException('packageId jest wymagany');
    return this.paymentsService.createCheckoutSession(req.user.userId, packageId);
  }

  @Get('history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment transaction history' })
  async getHistory(@Request() req: any) {
    return this.paymentsService.getTransactionHistory(req.user.userId);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook endpoint (no auth)' })
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody: Buffer = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Brak raw body');
    }
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
