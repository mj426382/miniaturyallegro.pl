import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Marker in `credit_grants.grantedBy` for referral bonuses (spec 20). */
export const REFERRAL_GRANTED_BY = 'polecenia';
const REFERRER_REASON = 'Polecenie – nagroda za nowe konto z Twojego linku';
const REFERRED_REASON = 'Polecenie – bonus za rejestrację z linku polecającego';

// No 0/o/1/l/i – codes are read aloud and typed from screenshots.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 8;
const CODE_PATTERN = /^[a-z0-9]{4,20}$/;

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value && Number.isInteger(n) && n >= 0 ? n : fallback;
}

/**
 * Spec 20: referral programme. Both sides get REFERRAL_BONUS credits once the referred account is
 * confirmed (e-mail link, or immediately for Google sign-ups); a referrer is rewarded for at most
 * REFERRAL_MAX_REWARDS accounts. Unknown codes are ignored.
 */
@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);
  readonly bonus: number;
  readonly maxRewards: number;
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.bonus = positiveInt(config.get<string>('REFERRAL_BONUS'), 3);
    this.maxRewards = positiveInt(config.get<string>('REFERRAL_MAX_REWARDS'), 25);
    this.frontendUrl = (config.get<string>('FRONTEND_URL') || 'https://app.allgrafika.pl').replace(/\/$/, '');
  }

  /** The referrer's id for a code typed into the sign-up, or null when unknown/invalid. */
  async resolveReferrer(code: string | undefined | null): Promise<string | null> {
    const normalized = (code || '').trim().toLowerCase();
    if (!CODE_PATTERN.test(normalized)) return null;
    const referrer = await this.prisma.user.findUnique({ where: { referralCode: normalized }, select: { id: true } });
    return referrer?.id ?? null;
  }

  /** AC-REF-001: the user's link (code created on first use) and the programme's results so far. */
  async summary(userId: string) {
    const code = await this.ensureCode(userId);
    const [referred, rewarded, earned] = await Promise.all([
      this.prisma.user.count({ where: { referredById: userId } }),
      this.prisma.user.count({ where: { referredById: userId, referralRewardedAt: { not: null } } }),
      this.prisma.creditGrant.aggregate({
        where: { userId, grantedBy: REFERRAL_GRANTED_BY, reason: REFERRER_REASON },
        _sum: { amount: true },
      }),
    ]);
    return {
      code,
      link: `${this.frontendUrl}/register?ref=${code}`,
      bonus: this.bonus,
      maxRewards: this.maxRewards,
      referred,
      rewarded,
      creditsEarned: earned._sum.amount ?? 0,
    };
  }

  /**
   * AC-REF-002/003/004: pays the bonus once per referred account. Safe to call repeatedly (row lock +
   * `referralRewardedAt`); never throws into the caller's flow.
   */
  async rewardIfEligible(userId: string): Promise<void> {
    if (this.bonus === 0) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ referredById: string | null; referralRewardedAt: Date | null }[]>`
          SELECT "referredById", "referralRewardedAt" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
        const user = rows[0];
        if (!user?.referredById || user.referralRewardedAt) return;

        await tx.user.update({
          where: { id: userId },
          data: { referralRewardedAt: new Date(), credits: { increment: this.bonus } },
        });
        await tx.creditGrant.create({
          data: { userId, amount: this.bonus, reason: REFERRED_REASON, grantedBy: REFERRAL_GRANTED_BY },
        });

        // Lock the referrer too, so two confirmations at once cannot both pass the cap.
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.referredById} FOR UPDATE`;
        const rewardedBefore = await tx.user.count({
          where: { referredById: user.referredById, referralRewardedAt: { not: null }, NOT: { id: userId } },
        });
        if (rewardedBefore >= this.maxRewards) return;
        await tx.user.update({ where: { id: user.referredById }, data: { credits: { increment: this.bonus } } });
        await tx.creditGrant.create({
          data: {
            userId: user.referredById,
            amount: this.bonus,
            reason: REFERRER_REASON,
            grantedBy: REFERRAL_GRANTED_BY,
          },
        });
      });
    } catch (err: any) {
      this.logger.error(`Referral bonus for user ${userId} failed: ${err?.message}`);
    }
  }

  private async ensureCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.referralCode) return user.referralCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
      try {
        const { count } = await this.prisma.user.updateMany({
          where: { id: userId, referralCode: null },
          data: { referralCode: code },
        });
        if (count === 1) return code;
        // Another request created the code in the meantime.
        const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
        if (current?.referralCode) return current.referralCode;
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err; // unique collision – try another code
      }
    }
    throw new Error('Could not create a referral code');
  }
}
