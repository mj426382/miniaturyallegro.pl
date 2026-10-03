import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsString, MaxLength, IsNotEmpty } from 'class-validator';

/**
 * Ustawa o prawach konsumenta, art. 38 ust. 1 pkt 13: the consumer loses the
 * 14-day right of withdrawal for digital content/services only after giving
 * express consent to immediate performance and acknowledging the loss.
 */
function WithdrawalWaiver(): PropertyDecorator {
  const decorators = [
    IsBoolean({ message: 'Wymagana jest zgoda na natychmiastowe rozpoczęcie świadczenia' }),
    Equals(true, { message: 'Aby kupić kredyty, musisz wyrazić zgodę na natychmiastowe rozpoczęcie świadczenia' }),
  ];
  return (target: object, key: string | symbol) => decorators.forEach((d) => d(target, key));
}

export class CreateCheckoutDto {
  @ApiProperty({ example: 'credits_15' })
  @IsString()
  @IsNotEmpty({ message: 'packageId jest wymagany' })
  @MaxLength(50)
  packageId: string;

  @ApiProperty({
    example: true,
    description: 'Zgoda na natychmiastowe udostępnienie kredytów i utratę prawa odstąpienia od umowy',
  })
  @WithdrawalWaiver()
  acceptedWithdrawalWaiver: boolean;
}

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'sub_start' })
  @IsString()
  @IsNotEmpty({ message: 'planId jest wymagany' })
  @MaxLength(50)
  planId: string;

  @ApiProperty({ example: true })
  @WithdrawalWaiver()
  acceptedWithdrawalWaiver: boolean;
}
