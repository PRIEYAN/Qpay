/**
 * SEAM — the single import point QpayProvider uses for wallet state.
 *
 * Now wired to the real `src/web3` layer (Reown AppKit + ethers); the
 * temporary shim has been deleted. Consumers import from here rather than
 * `../web3` directly so the wallet implementation can be swapped without
 * touching the context/services layer.
 */
export { useWallet } from '../web3';
export type { WalletContextValue as UseWalletResult, WalletStatus } from '../web3';

import { readOnlyProvider } from '../web3';

/**
 * Read-only Coston2 provider, available whether or not a wallet is connected —
 * every on-chain *read* path depends on this being usable while disconnected.
 */
export function getReadOnlyProvider() {
  return readOnlyProvider;
}
