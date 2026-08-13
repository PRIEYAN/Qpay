import { COSTON2 } from '../config/network';

/** `0x72` — the hex chainId Coston2 reports, used for wallet_* RPC calls. */
export const coston2ChainIdHex = `0x${COSTON2.chainId.toString(16)}`;

/**
 * Params for `wallet_addEthereumChain`, used as a fallback when a wallet
 * rejects `wallet_switchEthereumChain` because it doesn't know Coston2 yet
 * (EIP-3085). See https://eips.ethereum.org/EIPS/eip-3085
 */
export const addCoston2ChainParams = [
  {
    chainId: coston2ChainIdHex,
    chainName: COSTON2.name,
    nativeCurrency: COSTON2.nativeCurrency,
    rpcUrls: [COSTON2.rpcUrl],
    blockExplorerUrls: [COSTON2.explorerUrl],
  },
];
