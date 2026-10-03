import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ImagesModule } from '../images/images.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [ImagesModule, PaymentsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
