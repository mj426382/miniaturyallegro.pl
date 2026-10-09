import { Controller, Get, Patch, Delete, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength, IsNotEmpty, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { CurrentUser, SessionUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { ReferralsService } from '../referrals/referrals.service';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  /** Spec 16: tips and reminders by e-mail (marketing, opt-in). */
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  /** Spec 16: e-mail when a bulk batch is finished. */
  @IsOptional()
  @IsBoolean()
  notifyBatchDone?: boolean;
}

class DeleteAccountDto {
  /** The user must type their e-mail to confirm – protects against accidental clicks. */
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  confirmEmail: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private referrals: ReferralsService,
  ) {}

  @Get('me/referral')
  @ApiOperation({ summary: 'Spec 20: referral link (code created on first use) and the programme results' })
  async getReferral(@CurrentUser() user: SessionUser) {
    return this.referrals.summary(user.userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: SessionUser) {
    return this.usersService.findById(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@CurrentUser() user: SessionUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete own account and all data (RODO – right to erasure)' })
  async deleteAccount(@CurrentUser() user: SessionUser, @Body() dto: DeleteAccountDto) {
    return this.usersService.deleteAccount(user.userId, dto.confirmEmail);
  }
}
