import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AdminUsersService } from './admin-users.service';
import { GenerationModule } from '../generation/generation.module';
import { ImagesModule } from '../images/images.module';
import { AdminContentService } from './admin-content.service';

@Module({
  imports: [GenerationModule, ImagesModule],
  controllers: [AdminController],
  providers: [AdminService, AdminUsersService, AdminContentService, AdminGuard],
})
export class AdminModule {}
