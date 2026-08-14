import type { AppKitNetwork } from '@reown/appkit-react-native';
import { COSTON2 } from '../config/network';

/** Coston2 expressed as a Reown `AppKitNetwork` (the only chain Qpay supports). */
export const coston2Network: AppKitNetwork = {
  id: COSTON2.chainId,
  name: COSTON2.name,
  nativeCurrency: COSTON2.nativeCurrency,
  rpcUrls: {
    default: { http: [COSTON2.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Coston2 Explorer', url: COSTON2.explorerUrl },
  },
  chainNamespace: 'eip155',
  caipNetworkId: `eip155:${COSTON2.chainId}`,
  testnet: true,
};

/**
 * Chains Qpay will *accept a session on*, though it transacts only on Coston2.
 *
 * This list exists for one reason: a WalletConnect session is approved with
 * the chains the wallet already knows, and no wallet ships with Coston2. With
 * Coston2 as the only configured network, MetaMask approved a session on
 * `eip155:56` and AppKit — which filters accounts to its configured networks —
 * reported `isConnected: false, allAccounts: []`. The connection silently went
 * nowhere. Verified on-device 2026-08-13 against the stored session.
 *
 * So we accept the chains wallets are commonly sitting on, get a real session,
 * and then move the user to Coston2 via `switchToCoston2()` (which falls back
 * to `wallet_addEthereumChain`). Being connected on the wrong chain is a state
 * the app already handles — `requireSigner()` throws `WrongNetworkError` and
 * the wrong-network banner offers the switch — so nothing can be *sent* on
 * these. They only make the handshake succeed.
 */
const commonNetwork = (
  id: number,
  name: string,
  symbol: string,
  rpc: string,
  explorer: string,
): AppKitNetwork => ({
  id,
  name,
  nativeCurrency: { name: symbol, symbol, decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
  blockExplorers: { default: { name: `${name} Explorer`, url: explorer } },
  chainNamespace: 'eip155',
  caipNetworkId: `eip155:${id}`,
});

export const handshakeNetworks: AppKitNetwork[] = [
  commonNetwork(1, 'Ethereum', 'ETH', 'https://eth.llamarpc.com', 'https://etherscan.io'),
  commonNetwork(56, 'BNB Smart Chain', 'BNB', 'https://bsc-dataseed.binance.org', 'https://bscscan.com'),
  commonNetwork(137, 'Polygon', 'POL', 'https://polygon-rpc.com', 'https://polygonscan.com'),
  commonNetwork(8453, 'Base', 'ETH', 'https://mainnet.base.org', 'https://basescan.org'),
  commonNetwork(42161, 'Arbitrum One', 'ETH', 'https://arb1.arbitrum.io/rpc', 'https://arbiscan.io'),
];

/** Coston2 first — it stays the default and the only chain Qpay transacts on. */
export const supportedNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  coston2Network,
  ...handshakeNetworks,
];

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
