import { quoteConversion, clearPriceCache, roundAmount } from '../src/services/pricing';

/**
 * The pricing layer is now FTSOv2-backed rather than a fixed mock table, so
 * the property that matters is no longer "does it match the hardcoded rate"
 * — it's "does it refuse to invent a rate when it doesn't have one".
 *
 * A payments app that silently shows a fabricated conversion is worse than
 * one that shows nothing, so these tests pin the honesty behaviour.
 */
describe('quoteConversion', () => {
  beforeEach(() => {
    clearPriceCache();
  });

  it('passes the amount through untouched for a same-asset transfer', () => {
    const quote = quoteConversion(10, 'FXRP', 'FXRP');
    expect(quote.amountOut).toBe(10);
    expect(quote.isCrossAsset).toBe(false);
    expect(quote.spreadBps).toBe(0);
  });

  it('never needs a live price for a same-asset transfer, even with an empty cache', () => {
    // No feed has been read at all here — a same-asset move is still exact.
    const quote = quoteConversion(3.01, 'USDT0', 'USDT0');
    expect(quote.amountOut).toBe(3.01);
    expect(quote.stale).toBeFalsy();
  });

  it('reports a cross-asset quote as stale with a zero output rather than fabricating a rate', () => {
    // Nothing cached: the only honest answer is "I do not know yet".
    const quote = quoteConversion(10, 'USDT0', 'FXRP');
    expect(quote.isCrossAsset).toBe(true);
    expect(quote.stale).toBe(true);
    expect(quote.amountOut).toBe(0);
  });
});

describe('roundAmount', () => {
  it('does not accumulate binary floating point error on typical payment amounts', () => {
    expect(roundAmount(0.1 + 0.2)).toBe(0.3);
  });

  it('leaves an already-clean amount alone', () => {
    expect(roundAmount(18.46)).toBe(18.46);
  });
});
