/**
 * SEAM — the single import point every other module in src/contracts and
 * src/services uses for network/contract config.
 *
 * It now points at the real `src/config/network.ts` (the temporary local shim
 * has been deleted). Everything downstream imports from here rather than
 * reaching into `src/config` directly, so if the config ever moves again this
 * stays a one-file change.
 */
export * from '../config/network';

import type { TokenConfig as ConfigTokenConfig } from '../config/network';
import { COSTON2, CONTRACTS, TOKENS } from '../config/network';

/**
 * Type aliases under the names the contracts/services layer already uses.
 * Derived from the config's actual values rather than re-declared, so the
 * config file stays the single source of truth — if a token or contract is
 * added there, these widen automatically instead of silently drifting.
 */
export type CostonNetwork = typeof COSTON2;
export type ContractAddresses = typeof CONTRACTS;
export type TokenSymbol = keyof typeof TOKENS;
export type TokenConfig = ConfigTokenConfig;
