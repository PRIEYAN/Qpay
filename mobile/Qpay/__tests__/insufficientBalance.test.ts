import { toTokenAmount, fromTokenAmount } from '../src/contracts/decimals';
import { toBytes32Ref, fromBytes32Ref } from '../src/contracts/ref';
import { InsufficientBalanceError, InvalidAmountError } from '../src/services/errors';

/**
 * Decimal handling is the single most dangerous thing in this codebase:
 * FXRP and USDT0 are 6 decimals, WFLR is 18. Getting it wrong is an
 * off-by-10^12 error on real money, so it's pinned here explicitly.
 *
 * (These replace the previous tests against the in-memory mock's pay()/
 * redeemFxrp(), which now require deployed contracts and a connected wallet.)
 */
describe('token decimal conversion', () => {
  it('encodes 6-decimal tokens without inflating them to 18', () => {
    expect(toTokenAmount(1, 6)).toBe(1_000000n);
    expect(toTokenAmount(18.46, 6)).toBe(18_460000n);
  });

  it('encodes 18-decimal tokens correctly', () => {
    expect(toTokenAmount(1, 18)).toBe(10n ** 18n);
  });

  it('round-trips every asset Qpay supports without drift', () => {
    for (const [amount, decimals] of [
      [18.46, 6],
      [0.000001, 6],
      [1234.56, 6],
      [0.5, 18],
      [1000, 18],
    ] as const) {
      expect(fromTokenAmount(toTokenAmount(amount, decimals), decimals)).toBeCloseTo(amount, 10);
    }
  });

  it('keeps 6- and 18-decimal encodings distinct (the off-by-10^12 trap)', () => {
    expect(toTokenAmount(1, 6)).not.toBe(toTokenAmount(1, 18));
    expect(toTokenAmount(1, 18) / toTokenAmount(1, 6)).toBe(10n ** 12n);
  });

  it('refuses negative and non-finite amounts instead of encoding garbage', () => {
    expect(() => toTokenAmount(-1, 6)).toThrow(RangeError);
    expect(() => toTokenAmount(Number.NaN, 6)).toThrow(RangeError);
    expect(() => toTokenAmount(Number.POSITIVE_INFINITY, 6)).toThrow(RangeError);
  });
});

describe('payment reference encoding', () => {
  it('round-trips a short ref through bytes32', () => {
    expect(fromBytes32Ref(toBytes32Ref('send-123'))).toBe('send-123');
  });

  it('produces a valid bytes32 even for an over-long ref', () => {
    // encodeBytes32String throws past 31 bytes; the helper must fall back to a
    // hash rather than propagating a crash into the payment path.
    const long = 'x'.repeat(200);
    const encoded = toBytes32Ref(long);
    expect(encoded).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it('handles an empty ref', () => {
    expect(toBytes32Ref('')).toMatch(/^0x[0-9a-f]{64}$/i);
  });
});

describe('typed balance errors', () => {
  it('carries the fields the UI renders, so screens never parse a message string', () => {
    const err = new InsufficientBalanceError('FXRP', 100, 20);
    expect(err).toBeInstanceOf(Error);
    expect(err.asset).toBe('FXRP');
    expect(err.requested).toBe(100);
    expect(err.available).toBe(20);
  });

  it('distinguishes an invalid amount from an insufficient balance', () => {
    // Separate types so a screen can tell "you typed 0" apart from "you're broke".
    expect(new InvalidAmountError()).not.toBeInstanceOf(InsufficientBalanceError);
    expect(new InvalidAmountError().code).toBe('INVALID_AMOUNT');
  });
});
