import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ImagesModule } from '../images/images.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AccountTombstoneModule } from './account-tombstone.module';

@Module({
  imports: [ImagesModule, PaymentsModule, ReferralsModule, AccountTombstoneModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
