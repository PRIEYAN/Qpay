/**
 * Real, oracle-backed conversion pricing — QpaySwap (spread, per-asset feed
 * config) + QpayOracle (FTSOv2 prices), replacing the old fixed mock price
 * table entirely.
 *
 * `QpaySwap.convert()` is the on-chain source of truth for what a payment
 * actually converts to, but it can only be called by QpayLedger itself
 * (`NotLedger()` otherwise) — it moves real pool inventory and is meant to
 * run exactly once, inside `pay()`. So a UI *preview* quote can't call it.
 * Instead this reads the same two ingredients `convert()` uses —
 * `QpayOracle.priceOf()` (via a non-committing `staticCall`, since it's a
 * `nonpayable` FTSOv2 passthrough, not `view`) and `QpaySwap.spreadBIPS()` —
 * and reproduces `ConversionMath.sol`'s exact bigint arithmetic client-side
 * (`convertAmount` below). The real credited amount always comes from the
 * `Paid` event once a payment actually lands (see txMapping.ts); this quote
 * is only ever a preview.
 *
 * `quoteConversion()` stays a *synchronous* function — SendScreen (owned by
 * a different part of this task) calls it inside a plain `useMemo`, with no
 * loading state. `refreshPriceCache()` does the real async chain reads and
 * populates a small module-level cache; `quoteConversion()` reads that cache
 * synchronously. QpayProvider kicks off `refreshPriceCache()` on connect and
 * on an interval, so in practice the cache is warm well before a user
 * reaches the amount screen. Until the first refresh completes, a quote is
 * reported `stale: true` with `amountOut: 0` rather than a fabricated rate.
 */
import { ethers } from 'ethers';
import { getOracle, getSwap } from '../contracts';
import { tokenFor } from '../contracts/assets';
import { fromTokenAmount, toTokenAmount } from '../contracts/decimals';
import { PrimaryAsset } from './types';

const AMOUNT_DECIMALS = 6;

export function roundAmount(value: number, decimals = AMOUNT_DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export type ConversionQuote = {
  assetIn: PrimaryAsset;
  amountIn: number;
  assetOut: PrimaryAsset;
  /** Amount the recipient would receive in assetOut, after QpaySwap's spread — a preview, not a guarantee. */
  amountOut: number;
  /** amountOut per 1 unit of amountIn. */
  rate: number;
  spreadBps: number;
  isCrossAsset: boolean;
  /** True if this was computed from a cache that's empty or older than STALE_MS — never fabricated, but may be behind. */
  stale: boolean;
};

// ---------------------------------------------------------------------------
// ConversionMath.sol, ported 1:1 to TypeScript bigint arithmetic. See
// contract/contracts/libraries/ConversionMath.sol — kept byte-for-byte
// equivalent in shape (same multiply-then-divide ordering) so the two never
// silently drift apart on rounding.
// ---------------------------------------------------------------------------

const BIPS_DENOMINATOR = 10_000n;

function scale(numerator: bigint, denominator: bigint, posExp: number, negExp: number): [bigint, bigint] {
  const net = posExp - negExp;
  if (net > 0) return [numerator * 10n ** BigInt(net), denominator];
  if (net < 0) return [numerator, denominator * 10n ** BigInt(-net)];
  return [numerator, denominator];
}

/**
 * amountOut = amountIn * priceIn/10^priceInDecimals / (priceOut/10^priceOutDecimals)
 *           * 10^(decimalsOut - decimalsIn) * (10000 - spreadBIPS) / 10000
 * All bigint — never a float — for exactly the reason implementation.md §4 calls out.
 */
export function convertAmount(
  amountIn: bigint,
  priceIn: bigint,
  priceInDecimals: number,
  priceOut: bigint,
  priceOutDecimals: number,
  decimalsIn: number,
  decimalsOut: number,
  spreadBIPS: bigint,
): bigint {
  if (priceIn <= 0n || priceOut <= 0n) throw new RangeError('convertAmount: price must be > 0');
  if (spreadBIPS > BIPS_DENOMINATOR) throw new RangeError('convertAmount: spread must be <= 10000 bips');

  let numerator = amountIn * priceIn;
  let denominator = priceOut;
  [numerator, denominator] = scale(numerator, denominator, priceOutDecimals, priceInDecimals);
  [numerator, denominator] = scale(numerator, denominator, decimalsOut, decimalsIn);

  let amountOut = numerator / denominator;
  amountOut = (amountOut * (BIPS_DENOMINATOR - spreadBIPS)) / BIPS_DENOMINATOR;
  return amountOut;
}

// ---------------------------------------------------------------------------
// Cache — populated by refreshPriceCache(), read synchronously by quoteConversion().
// ---------------------------------------------------------------------------

type CachedPrice = { value: bigint; decimals: number; fetchedAt: number };

const STALE_MS = 5 * 60 * 1000; // 5 minutes — FTSOv2 feeds themselves are only guaranteed fresh to MAX_STALENESS (120s) on-chain; this is a client display threshold, not a safety boundary.
const ZERO_FEED = `0x${'00'.repeat(21)}`;

const priceCache = new Map<PrimaryAsset, CachedPrice>();
const decimalsCache = new Map<PrimaryAsset, number>();
let spreadBipsCache: bigint | null = null;

/**
 * Real chain reads: QpaySwap.feedOf/decimalsOf (view) + QpayOracle.priceOf
 * (staticCall — simulated, no tx, no signer needed) for every asset whose
 * token address is configured. Safe to call with a read-only Provider.
 * Silently skips assets that aren't configured yet on TOKENS or on the Swap
 * contract (`AssetNotConfigured`) rather than throwing, so a partially
 * configured deployment still prices the assets it can.
 */
export async function refreshPriceCache(runner: ethers.ContractRunner): Promise<void> {
  const swap = getSwap(runner);
  const oracle = getOracle(runner);

  const spread: bigint = await swap.spreadBIPS();
  spreadBipsCache = spread;

  const assets: PrimaryAsset[] = ['FXRP', 'FLR', 'USDT0'];
  await Promise.all(
    assets.map(async (asset) => {
      const token = tokenFor(asset);
      if (!token.address) return;
      try {
        const feedId: string = await swap.feedOf(token.address);
        if (!feedId || feedId.toLowerCase() === ZERO_FEED) return;

        const swapDecimals: bigint = await swap.decimalsOf(token.address);
        const [value, decimals] = await oracle.priceOf.staticCall(feedId);
        priceCache.set(asset, { value, decimals: Number(decimals), fetchedAt: Date.now() });
        decimalsCache.set(asset, Number(swapDecimals));
      } catch {
        // Leave this asset's cache entry as-is (or absent) — quoteConversion()
        // reports `stale: true` rather than throwing mid-render.
      }
    }),
  );
}

/** Test-only / reset hook — clears the module-level cache. */
export function clearPriceCache(): void {
  priceCache.clear();
  decimalsCache.clear();
  spreadBipsCache = null;
}

/**
 * Synchronous quote, backed by the cache `refreshPriceCache()` populates.
 * Never fabricates a price: if nothing's cached yet for either asset, or the
 * spread hasn't been read, returns `amountOut: 0, stale: true` rather than a
 * mock rate. See the module doc comment for why this has to stay sync.
 */
export function quoteConversion(
  amountIn: number,
  assetIn: PrimaryAsset,
  assetOut: PrimaryAsset,
): ConversionQuote {
  if (assetIn === assetOut) {
    return {
      assetIn,
      amountIn,
      assetOut,
      amountOut: roundAmount(amountIn),
      rate: 1,
      spreadBps: 0,
      isCrossAsset: false,
      stale: false,
    };
  }

  const priceIn = priceCache.get(assetIn);
  const priceOut = priceCache.get(assetOut);

  if (!priceIn || !priceOut || spreadBipsCache == null || !(amountIn >= 0)) {
    return {
      assetIn,
      amountIn,
      assetOut,
      amountOut: 0,
      rate: 0,
      spreadBps: spreadBipsCache != null ? Number(spreadBipsCache) : 0,
      isCrossAsset: true,
      stale: true,
    };
  }

  const decimalsIn = decimalsCache.get(assetIn) ?? tokenFor(assetIn).decimals;
  const decimalsOut = decimalsCache.get(assetOut) ?? tokenFor(assetOut).decimals;

  const amountInRaw = toTokenAmount(amountIn, decimalsIn);
  const amountOutRaw = convertAmount(
    amountInRaw,
    priceIn.value,
    priceIn.decimals,
    priceOut.value,
    priceOut.decimals,
    decimalsIn,
    decimalsOut,
    spreadBipsCache,
  );
  const amountOut = fromTokenAmount(amountOutRaw, decimalsOut);
  const oldestFetch = Math.min(priceIn.fetchedAt, priceOut.fetchedAt);

  return {
    assetIn,
    amountIn,
    assetOut,
    amountOut,
    rate: amountIn === 0 ? 0 : roundAmount(amountOut / amountIn),
    spreadBps: Number(spreadBipsCache),
    isCrossAsset: true,
    stale: Date.now() - oldestFetch > STALE_MS,
  };
}
