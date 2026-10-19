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
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  imports: [GenerationModule, ImagesModule, PaymentsModule],
  controllers: [AdminController, PartnersController],
  providers: [AdminService, AdminUsersService, AdminContentService, DiscountCodesService, PartnersService, AdminGuard],
})
export class AdminModule {}
