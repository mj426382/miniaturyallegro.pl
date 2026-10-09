import { Module } from '@nestjs/common';
import { ReferralsService } from './referrals.service';

/** Spec 20: referral programme (PrismaService and ConfigService are global). */
@Module({
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
