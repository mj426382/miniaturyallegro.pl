import { heldGrosze, netPaidGrosze } from '../admin/revenue';
import {
  addMonthsUtc,
  commissionOf,
  customerRef,
  isCalendarDate,
  isValidNip,
  MIN_PAYOUT_GROSZE,
  normalizeNip,
  PARTNER_DEFAULTS,
  todayInPoland,
} from './commission';

describe('partner programme rules (spec 24)', () => {
  describe('commission maths', () => {
    it.each([
      // [net grosze, percent, commission grosze]
      [2520, 20, 504], // 25,20 zł × 20%
      [2800, 20, 560],
      [5500, 20, 1100],
      [1900, 20, 380],
      [9900, 20, 1980],
      [3, 50, 2], // 1,5 gr → 2 gr (half up)
      [1, 50, 1], // 0,5 gr → 1 gr
      [1, 20, 0], // 0,2 gr → 0
      [2, 25, 1], // 0,5 gr → 1 gr
      [5, 10, 1], // 0,5 gr → 1 gr
      [4, 10, 0], // 0,4 gr → 0
      [15, 10, 2], // 1,5 gr → 2 gr
      [14, 10, 1], // 1,4 gr → 1 gr
      [999_999_99, 50, 499_999_99 + 1], // 99 999 999 × 0,5 = 49 999 999,5 → 50 000 000
      [1000, 1, 10],
    ])('[AC-PRT-009] %i gr at %i%% earns %i gr (halves rounded up, integer arithmetic)', (net, percent, expected) => {
      expect(commissionOf(net, percent)).toBe(expected);
    });

    it('[AC-PRT-009] nothing is earned on nothing: 0, negative, fully refunded or a 0% rate', () => {
      expect(commissionOf(0, 20)).toBe(0);
      expect(commissionOf(-500, 20)).toBe(0);
      expect(commissionOf(1000, 0)).toBe(0);
      expect(commissionOf(Number.NaN, 20)).toBe(0);
      expect(commissionOf(1000, Number.POSITIVE_INFINITY)).toBe(0);
    });

    it('[AC-PRT-009] matches round(percent × net / 100) for every amount up to 100 zł and every allowed rate', () => {
      for (let percent = 1; percent <= 50; percent++) {
        for (let net = 0; net <= 10_000; net += 7) {
          const exact = (net * percent) / 100;
          const expected = Math.floor(exact) + (exact - Math.floor(exact) >= 0.5 - 1e-9 ? 1 : 0);
          expect(commissionOf(net, percent)).toBe(expected);
        }
      }
    });

    it('[AC-PRT-010] the commission base is the same net amount as the panel revenue (refunds and open/lost disputes held)', () => {
      const row = (amountPln: number, amountRefunded: number, disputeAmount: number) => ({
        amountPln,
        amountRefunded,
        disputeAmount,
      });
      expect(netPaidGrosze(row(2520, 0, 0))).toBe(2520);
      expect(netPaidGrosze(row(2520, 1000, 0))).toBe(1520);
      expect(netPaidGrosze(row(2520, 2520, 0))).toBe(0);
      expect(netPaidGrosze(row(2520, 0, 2520))).toBe(0); // open or lost dispute
      expect(netPaidGrosze(row(2520, 1000, 2520))).toBe(0); // never below 0
      expect(heldGrosze(row(2520, 1000, 2520))).toBe(2520); // never more than the payment
      expect(netPaidGrosze(row(0, 0, 0))).toBe(0); // 100% code
      expect(netPaidGrosze(row(1000, -5, -5))).toBe(1000); // defensive: negative amounts are ignored
      // a refund then a full commission recomputation stays consistent: commission(net) of each step
      const steps = [0, 300, 1100, 2520].map((refunded) => commissionOf(netPaidGrosze(row(2520, refunded, 0)), 20));
      expect(steps).toEqual([504, 444, 284, 0]);
    });
  });

  describe('commission period', () => {
    it.each([
      ['2026-10-19T10:15:30.123Z', 12, '2027-10-19T10:15:30.123Z'],
      ['2026-01-31T12:00:00.000Z', 1, '2026-02-28T12:00:00.000Z'], // clamped to the end of February
      ['2028-01-31T12:00:00.000Z', 1, '2028-02-29T12:00:00.000Z'], // leap year
      ['2026-03-31T21:30:00.000Z', 12, '2027-03-31T21:30:00.000Z'],
      ['2026-08-31T00:00:00.000Z', 1, '2026-09-30T00:00:00.000Z'],
      ['2026-12-15T23:59:59.999Z', 1, '2027-01-15T23:59:59.999Z'], // over the year end
      ['2026-05-10T08:00:00.000Z', 60, '2031-05-10T08:00:00.000Z'],
    ])('[AC-PRT-008] %s + %i months = %s (calendar months in UTC)', (from, months, to) => {
      expect(addMonthsUtc(new Date(from), months).toISOString()).toBe(to);
    });

    it('[AC-PRT-008] does not modify the date it was given', () => {
      const date = new Date('2026-01-31T12:00:00.000Z');
      addMonthsUtc(date, 1);
      expect(date.toISOString()).toBe('2026-01-31T12:00:00.000Z');
    });
  });

  describe('masked customers, NIP and dates', () => {
    it('[AC-PRT-013] a customer is "K-" + 8 hex characters, stable per account and free of the account id', () => {
      const ref = customerRef('ckaccount000000000000001');
      expect(ref).toMatch(/^K-[0-9a-f]{8}$/);
      expect(customerRef('ckaccount000000000000001')).toBe(ref);
      expect(customerRef('ckaccount000000000000002')).not.toBe(ref);
      expect(ref).not.toContain('ckaccount');
    });

    it.each([
      ['5260001246', true],
      ['526-000-12-46', true],
      ['526 000 12 46', true],
      ['PL5260001246', true],
      ['pl 526-000-12-46', true],
      ['5260001245', false], // wrong check digit
      ['526000124', false], // 9 digits
      ['52600012466', false], // 11 digits
      ['52600O1246', false], // letter O
      ['', false],
      ['1234563217', false], // check sum 10 is never valid
    ])('[AC-PRT-002] NIP %s valid: %s', (nip, valid) => {
      expect(isValidNip(nip)).toBe(valid);
    });

    it('[AC-PRT-001] NIP is stored as 10 digits', () => {
      expect(normalizeNip(' PL 526-000-12-46 ')).toBe('5260001246');
    });

    it('[AC-PRT-012] payout dates are real calendar dates and "today" is the Polish date', () => {
      expect(isCalendarDate('2026-11-05')).toBe(true);
      expect(isCalendarDate('2028-02-29')).toBe(true);
      expect(isCalendarDate('2026-02-29')).toBe(false);
      expect(isCalendarDate('2026-13-01')).toBe(false);
      expect(isCalendarDate('2026-1-5')).toBe(false);
      expect(isCalendarDate('jutro')).toBe(false);
      // 23:30 UTC on 31 October is already 1 November in Poland (CET, UTC+1)
      expect(todayInPoland(new Date('2026-10-31T23:30:00.000Z'))).toBe('2026-11-01');
      expect(todayInPoland(new Date('2026-10-31T22:30:00.000Z'))).toBe('2026-10-31');
      // summer time (CEST, UTC+2)
      expect(todayInPoland(new Date('2026-06-30T22:30:00.000Z'))).toBe('2026-07-01');
    });

    it('[AC-PRT-001] the defaults are the approved model and the payout threshold is 50 zł', () => {
      expect(PARTNER_DEFAULTS).toEqual({ customerDiscountPercent: 10, commissionPercent: 20, commissionMonths: 12 });
      expect(MIN_PAYOUT_GROSZE).toBe(5000);
    });
  });
});
