import { computeLotBreakdown } from '../src/contracts/lots';

/**
 * FAssets redemption burns whole lots only (implementation.md §5.2). The
 * sub-lot remainder must stay spendable rather than being silently swallowed,
 * so this math is the difference between a correct withdrawal and quietly
 * losing a user's money.
 *
 * These test the pure function rather than `redeemFxrp()`, which now requires
 * a deployed contract and a connected wallet.
 */
describe('computeLotBreakdown', () => {
  const LOT = 10; // Coston2's current lot size; read live in production code.

  it('redeems floor(amount / lotSize) lots and leaves the remainder spendable', () => {
    expect(computeLotBreakdown(505, LOT)).toEqual({ lots: 50, exact: 500, remainder: 5 });
  });

  it('treats exactly one lot as the minimum viable redemption', () => {
    expect(computeLotBreakdown(10, LOT)).toEqual({ lots: 1, exact: 10, remainder: 0 });
  });

  it('yields zero lots below one lot, leaving the whole amount spendable', () => {
    // The caller turns this into BelowLotSizeError — nothing is ever debited.
    expect(computeLotBreakdown(9.99, LOT)).toEqual({ lots: 0, exact: 0, remainder: 9.99 });
  });

  it('never debits more than the requested amount', () => {
    for (const amount of [0, 1, 9.999, 10, 10.0001, 37.5, 1000]) {
      const { exact, remainder } = computeLotBreakdown(amount, LOT);
      expect(exact).toBeLessThanOrEqual(amount);
      expect(exact + remainder).toBeCloseTo(amount, 8);
      expect(remainder).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not hardcode a lot size of 10', () => {
    // Mainnet lot size differs; the function must follow whatever it is told.
    expect(computeLotBreakdown(100, 32)).toEqual({ lots: 3, exact: 96, remainder: 4 });
  });

  it('rejects a nonsensical lot size rather than dividing by zero', () => {
    expect(() => computeLotBreakdown(100, 0)).toThrow(RangeError);
  });

  it('rejects a negative or non-finite amount', () => {
    expect(() => computeLotBreakdown(-1, LOT)).toThrow(RangeError);
    expect(() => computeLotBreakdown(Number.NaN, LOT)).toThrow(RangeError);
  });
});
