import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AdminUsersService } from './admin-users.service';
import { GenerationModule } from '../generation/generation.module';
import { ImagesModule } from '../images/images.module';
import { AdminContentService } from './admin-content.service';
import { DiscountCodesService } from './discount-codes.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [GenerationModule, ImagesModule, PaymentsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminUsersService, AdminContentService, DiscountCodesService, AdminGuard],
})
export class AdminModule {}
