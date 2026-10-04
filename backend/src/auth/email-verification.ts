import { HttpException, HttpStatus } from '@nestjs/common';
import { parseBool } from '../config/env.validation';

/** Link validity (spec 13). */
export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** Minimum gap between two verification e-mails for one account. */
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

/** Operators can switch the gate off when mail delivery is broken (`EMAIL_VERIFICATION_REQUIRED=false`). */
export function isVerificationRequired(value: string | undefined): boolean {
  return parseBool(value, true);
}

/** 403 returned by every action that spends or buys credits before the address is confirmed. */
export function emailNotVerifiedException(): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.FORBIDDEN,
      error: 'Forbidden',
      code: EMAIL_NOT_VERIFIED,
      message:
        'Potwierdź adres e-mail, aby generować grafiki i kupować kredyty. Kliknij link z wiadomości, którą wysłaliśmy po rejestracji – możesz też wysłać go ponownie z banera u góry strony.',
    },
    HttpStatus.FORBIDDEN,
  );
}
