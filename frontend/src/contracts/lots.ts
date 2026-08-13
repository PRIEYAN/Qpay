export type LotBreakdown = {
  /** Whole lots that will actually be redeemed. */
  lots: number;
  /** lots * lotSize — the amount debited/sent to the AssetManager. */
  exact: number;
  /** amount - exact — never debited, stays spendable. */
  remainder: number;
};

/**
 * Pure lot-granularity math for FAssets redemption (implementation.md §5.2).
 * Redemption always burns whole lots; anything below a lot boundary is never
 * debited. `lotSize` must be read live from the AssetManager
 * (`AssetManager.lotSize()`, exposed via QpayGateway.assetManager()) — never
 * hardcoded, since Coston2's 10 FXRP/lot is not guaranteed to match mainnet
 * or to stay constant over time.
 */
export function computeLotBreakdown(amount: number, lotSize: number): LotBreakdown {
  if (!(lotSize > 0)) {
    throw new RangeError(`computeLotBreakdown: lotSize must be > 0, got ${lotSize}`);
  }
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`computeLotBreakdown: amount must be a finite number >= 0, got ${amount}`);
  }
  const lots = Math.floor(amount / lotSize);
  const exact = lots * lotSize;
  const remainder = Math.max(0, amount - exact);
  return { lots, exact, remainder };
}
