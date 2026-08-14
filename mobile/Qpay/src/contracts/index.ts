import { ethers } from 'ethers';
import QpayLedgerAbi from './abis/QpayLedger.json';
import QpayGatewayAbi from './abis/QpayGateway.json';
import QpaySwapAbi from './abis/QpaySwap.json';
import QpayOracleAbi from './abis/QpayOracle.json';
import ERC20Abi from './abis/ERC20.json';
import AssetManagerAbi from './abis/AssetManager.json';
import { CONTRACTS, COSTON2 } from './networkConfig';
import { NotConfiguredError } from '../services/errors';

/**
 * Typed contract accessors. Every factory takes a `runner` — pass a
 * `Provider` (e.g. `wallet.getProvider()`) for reads, or a `Signer` (e.g.
 * `await wallet.getSigner()`) for anything that sends a transaction. None of
 * these cache a contract instance across calls: constructing an
 * `ethers.Contract` is cheap and this keeps "which runner is this bound to"
 * unambiguous at every call site.
 */
export type ContractRunner = ethers.ContractRunner;

function requireAddress(address: string, label: string): string {
  if (!address || address.trim().length === 0) {
    throw new NotConfiguredError(
      `${label} address is not configured yet. Deploy the Qpay contracts to Coston2 and paste the ` +
        'addresses into CONTRACTS in src/config/network.ts.',
    );
  }
  return address;
}

export function getLedger(runner: ContractRunner): ethers.Contract {
  return new ethers.Contract(requireAddress(CONTRACTS.qpayLedger, 'QpayLedger'), QpayLedgerAbi, runner);
}

export function getGateway(runner: ContractRunner): ethers.Contract {
  return new ethers.Contract(requireAddress(CONTRACTS.qpayGateway, 'QpayGateway'), QpayGatewayAbi, runner);
}

export function getSwap(runner: ContractRunner): ethers.Contract {
  return new ethers.Contract(requireAddress(CONTRACTS.qpaySwap, 'QpaySwap'), QpaySwapAbi, runner);
}

export function getOracle(runner: ContractRunner): ethers.Contract {
  return new ethers.Contract(requireAddress(CONTRACTS.qpayOracle, 'QpayOracle'), QpayOracleAbi, runner);
}

export function getErc20(address: string, runner: ContractRunner): ethers.Contract {
  return new ethers.Contract(requireAddress(address, 'ERC20 token'), ERC20Abi, runner);
}

/** `address` is `QpayGateway.assetManager()` — the live FAssets AssetManagerFXRP diamond. */
export function getAssetManager(address: string, runner: ContractRunner): ethers.Contract {
  return new ethers.Contract(requireAddress(address, 'AssetManager'), AssetManagerAbi, runner);
}

/**
 * Convenience: reads `gateway.assetManager()` then binds an AssetManager
 * contract to it, for `lotSize()` reads (implementation.md §5 — redemption
 * is lot-granular and the lot size must never be hardcoded).
 */
export async function getAssetManagerForGateway(runner: ContractRunner): Promise<ethers.Contract> {
  const gateway = getGateway(runner);
  const assetManagerAddress: string = await gateway.assetManager();
  return getAssetManager(assetManagerAddress, runner);
}

let sharedDefaultProvider: ethers.JsonRpcProvider | null = null;

/**
 * A genuine read-only Coston2 provider, independent of any wallet connection
 * — used as qpayService's fallback runner before a wallet layer has called
 * `setWalletContext()` (e.g. very early app boot, or in tests that exercise
 * qpayService directly). Permanent (unlike src/contracts/tempWalletLayer.ts,
 * which goes away once src/web3 lands) — reads should always work off
 * Coston2 regardless of wallet state.
 */
export function getDefaultProvider(): ethers.JsonRpcProvider {
  if (!sharedDefaultProvider) {
    sharedDefaultProvider = new ethers.JsonRpcProvider(COSTON2.rpcUrl, COSTON2.chainId);
  }
  return sharedDefaultProvider;
}

export {
  CONTRACTS,
  COSTON2,
  DEPLOY_BLOCK,
  MAX_LOG_BLOCK_RANGE,
  TOKENS,
  WALLETCONNECT_PROJECT_ID,
  isConfigured,
  assertConfigured,
} from './networkConfig';
export type { ContractAddresses, TokenConfig, TokenSymbol } from './networkConfig';
export { ASSET_TOKEN_MAP, assetForTokenAddress, tokenFor } from './assets';
export { toTokenAmount, fromTokenAmount } from './decimals';
export { toBytes32Ref, fromBytes32Ref } from './ref';
export { computeLotBreakdown } from './lots';
export type { LotBreakdown } from './lots';
