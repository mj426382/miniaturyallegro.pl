import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PartnerLedgerService } from '../partners/partner-ledger.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PartnerLedgerService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
