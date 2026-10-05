import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AdminUsersService } from './admin-users.service';
import { GenerationModule } from '../generation/generation.module';

@Module({
  imports: [GenerationModule],
  controllers: [AdminController],
  providers: [AdminService, AdminUsersService, AdminGuard],
})
export class AdminModule {}
