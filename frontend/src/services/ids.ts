/**
 * Local identifier generation.
 *
 * This module deliberately contains ONLY `generateId`, which is used for
 * purely local records (a user-saved contact, a locally-tracked payment
 * request) that have no on-chain existence.
 *
 * It replaces an earlier `fake.ts` that also exported `fakeTxHash()`,
 * `fakeEvmAddress()` and `fakeXrplAddress()`. Those are gone on purpose: this
 * app now runs entirely on real chain data, and a helper that manufactures a
 * plausible-looking transaction hash or wallet address is precisely the kind
 * of thing that gets called by accident and turns fabricated data into
 * something the UI presents as real. If you need a hash or an address, it must
 * come from the chain.
 */

/** Short unique id for local-only records. Not an on-chain identifier. */
export function generateId(prefix = 'local'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
