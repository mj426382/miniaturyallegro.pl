import { Module } from '@nestjs/common';
import { AccountTombstoneService } from './account-tombstone.service';

/** Spec 03: tombstones of deleted accounts (PrismaService and ConfigService are global). */
@Module({
  providers: [AccountTombstoneService],
  exports: [AccountTombstoneService],
})
export class AccountTombstoneModule {}
