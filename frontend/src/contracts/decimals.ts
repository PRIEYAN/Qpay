import { ethers } from 'ethers';

/**
 * Decimal-safe conversion between a human-facing `number` (display / user
 * input only) and the `bigint` smallest-unit amount that crosses the ABI
 * boundary.
 *
 * FXRP and USDT0 are 6 decimals; WFLR is 18 (implementation.md §0's "gotcha
 * that will cost you 20 minutes"). Never hand-roll `* 10 ** n` or reach for
 * `ethers.parseEther`/`formatEther` (hardcodes 18) — always go through these
 * two helpers with the specific token's own `decimals`, sourced from
 * `TOKENS[...].decimals`, never a bare literal.
 */

/** number (display units) -> bigint (smallest on-chain units). */
export function toTokenAmount(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`toTokenAmount: amount must be finite, got ${amount}`);
  }
  if (amount < 0) {
    throw new RangeError(`toTokenAmount: amount must be >= 0, got ${amount}`);
  }
  // toFixed avoids exponential notation (parseUnits rejects e.g. "1e-7") and
  // caps precision at the token's own decimals, so rounding happens once,
  // deliberately, here — never as a side effect of float noise downstream.
  const fixed = amount.toFixed(decimals);
  return ethers.parseUnits(fixed, decimals);
}

/** bigint (smallest on-chain units) -> number (display units only — never feed back into money math). */
export function fromTokenAmount(raw: bigint, decimals: number): number {
  return Number(ethers.formatUnits(raw, decimals));
}
