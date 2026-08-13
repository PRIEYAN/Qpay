/**
 * Deployment-specific configuration for Qpay.
 *
 * This is the ONE place that knows about the target network, the deployed
 * Qpay contract addresses, and third-party service credentials (WalletConnect
 * / Reown project id). Nothing in this file should require a running app —
 * it's plain data so any layer (wallet, contracts, UI) can import it.
 *
 * Qpay runs entirely on Flare Coston2 testnet (chainId 114).
 */

/** A network definition shaped like ethers/viem's common `chain` object. */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Flare Coston2 testnet.
 * Verified against the live RPC on 2026-08-12 (eth_chainId -> 0x72 -> 114).
 */
export const COSTON2: NetworkConfig = {
  chainId: 114,
  name: 'Flare Coston2',
  rpcUrl: 'https://coston2-api.flare.network/ext/C/rpc',
  explorerUrl: 'https://coston2-explorer.flare.network',
  nativeCurrency: {
    name: 'Coston2 Flare',
    symbol: 'C2FLR',
    decimals: 18,
  },
};

/** Addresses for the Qpay contracts themselves. */
export interface ContractsConfig {
  qpayLedger: string;
  qpayGateway: string;
  qpaySwap: string;
  qpayOracle: string;
}

/**
 * Qpay's own contracts on Coston2.
 *
 * Deployed 2026-08-13 via `npm run deploy:coston2` (Hardhat Ignition module
 * `QpayModule`, journal at contract/ignition/deployments/chain-114/). Verified
 * live against the Coston2 RPC: all four have bytecode, and the wiring calls
 * landed — ledger.swap/gateway point at the addresses below, swap.ledger and
 * swap.oracle match, gateway.fxrp is FXRP, and allowedAsset[FXRP] is true.
 *
 * Nothing else in the app should hold a second copy of these addresses.
 * Re-deploying to a fresh chain means updating them here and nowhere else.
 */
export const CONTRACTS: ContractsConfig = {
  qpayLedger: '0x077B220DC9106EaD8Fcd4A30B95CAfb712bdBe4B',
  qpayGateway: '0x5a0883E98644e50518b08CDCe0bFaf11f2a79058',
  qpaySwap: '0xbf670ced92915ff800B836Cb7Fd6342f05467B15',
  qpayOracle: '0x39094eA11969c4A4e312C3083AaE8809408e01bd',
};

/**
 * Block QpayLedger was mined in (33997199; the other three landed within the
 * next 32 blocks). Qpay cannot have emitted an event before this, so event
 * scans start here instead of block 0 — at ~1.8s blocks, block 0 is ~34
 * million blocks of empty range that the RPC would make us walk 30 at a time.
 */
export const DEPLOY_BLOCK = 33997199;

/**
 * Coston2's public RPC hard-caps `eth_getLogs` at **30 blocks** per request —
 * ask for 31 and it returns `-32000 requested too many blocks from X to Y,
 * maximum is set to 30`. Verified against the live node on 2026-08-13. Every
 * event query has to be chunked to this, so it lives next to the RPC url it
 * is a property of rather than being buried in the service layer.
 */
export const MAX_LOG_BLOCK_RANGE = 30;

export interface TokenConfig {
  address: string;
  decimals: number;
  symbol: string;
}

/**
 * ERC-20 tokens used by Qpay on Coston2.
 *
 * FXRP is a verified, already-deployed Coston2 address. USDT0 and WFLR are
 * left as placeholders — fill them in if/when Qpay needs those assets; they
 * are intentionally NOT part of `isConfigured()`/`assertConfigured()` below
 * since only FXRP is currently required.
 */
export const TOKENS: Record<'FXRP' | 'USDT0' | 'WFLR', TokenConfig> = {
  FXRP: {
    address: '0x0b6a3645c240605887a5532109323a3e12273dc7',
    decimals: 6,
    symbol: 'FXRP',
  },
  USDT0: {
    address: '',
    decimals: 6,
    symbol: 'USDT0',
  },
  WFLR: {
    address: '',
    decimals: 18,
    symbol: 'WFLR',
  },
};

/**
 * Flare-provided protocol infrastructure on Coston2 (not deployed by Qpay,
 * addresses are stable/well-known for the network itself).
 */
export const FLARE_PROTOCOL_CONTRACTS = {
  ftsoV2: '0xc4e9c78ea53db782e28f28fdf80baf59336b304d',
  assetManagerFXRP: '0xc1ca88b937d0b528842f95d5731ffb586f4fbdfa',
};

/**
 * WalletConnect / Reown Cloud project id, required to open real wallet
 * connections (MetaMask mobile etc.) via `@reown/appkit-ethers-react-native`.
 *
 * Get one for free at https://cloud.reown.com, then paste it below.
 */
export const WALLETCONNECT_PROJECT_ID = '';

/** True once a WalletConnect project id has been set. */
export function isWalletConnectConfigured(): boolean {
  return WALLETCONNECT_PROJECT_ID.trim().length > 0;
}

interface RequiredField {
  path: string;
  value: string;
  hint: string;
}

/**
 * The contract addresses a chain *read or write* needs to be possible at all.
 *
 * Deliberately does NOT include `WALLETCONNECT_PROJECT_ID`: that credential
 * only gates opening a wallet session (connect / sign). Read paths — balances,
 * transaction history, conversion quotes — run on the read-only Coston2
 * provider and must keep working while no wallet is connected. Folding the
 * two together made every read throw "not configured" for a reason that had
 * nothing to do with the contracts. See `isWalletConnectConfigured()`.
 */
function getRequiredFields(): RequiredField[] {
  return [
    {
      path: 'CONTRACTS.qpayLedger',
      value: CONTRACTS.qpayLedger,
      hint: 'Deploy QpayLedger to Coston2 and paste its address into CONTRACTS.qpayLedger in src/config/network.ts',
    },
    {
      path: 'CONTRACTS.qpayGateway',
      value: CONTRACTS.qpayGateway,
      hint: 'Deploy QpayGateway to Coston2 and paste its address into CONTRACTS.qpayGateway in src/config/network.ts',
    },
    {
      path: 'CONTRACTS.qpaySwap',
      value: CONTRACTS.qpaySwap,
      hint: 'Deploy QpaySwap to Coston2 and paste its address into CONTRACTS.qpaySwap in src/config/network.ts',
    },
    {
      path: 'CONTRACTS.qpayOracle',
      value: CONTRACTS.qpayOracle,
      hint: 'Deploy QpayOracle to Coston2 and paste its address into CONTRACTS.qpayOracle in src/config/network.ts',
    },
  ];
}

/**
 * True once all four Qpay contract addresses are filled in — i.e. the app can
 * talk to the chain. Wallet connectivity is a separate axis; check
 * `isWalletConnectConfigured()` for that.
 *
 * Screens/services that talk to Qpay's own contracts should call this (or
 * `assertConfigured()`) before making a call, rather than each re-deriving
 * their own "is this empty" check.
 */
export function isConfigured(): boolean {
  return getRequiredFields().every(field => field.value.trim().length > 0);
}

/**
 * Throws a clear, human-readable error naming exactly which config field(s)
 * are still missing and where to get/paste the value, instead of letting
 * callers fail later with a cryptic "invalid address" or SDK error.
 */
export function assertConfigured(): void {
  const missing = getRequiredFields().filter(field => field.value.trim().length === 0);
  if (missing.length === 0) {
    return;
  }

  const lines = missing.map(field => `  - ${field.path}: ${field.hint}`).join('\n');
  throw new Error(`Qpay is not fully configured yet. Missing:\n${lines}`);
}
