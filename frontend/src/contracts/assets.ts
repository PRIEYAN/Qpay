import { ethers } from 'ethers';
import { PRIMARY_ASSETS, PrimaryAsset } from '../services/types';
import { TokenConfig, TokenSymbol, TOKENS } from './networkConfig';

/**
 * Qpay's UI-facing `PrimaryAsset` union ('FXRP' | 'FLR' | 'USDT0') predates
 * the deployed contracts, whose strict allowlist is exactly FXRP, USDT0, and
 * WFLR (implementation.md §3 — native FLR can't be custodied by an ERC-20
 * ledger, only its wrapped ERC-20 can). Renaming 'FLR' to 'WFLR' throughout
 * would ripple into screens this task doesn't own (e.g.
 * PrimaryChainPickerScreen's `CHOICES` literally uses `'FLR'`), so instead
 * 'FLR' is kept as the UI symbol and mapped to the WFLR token here, in one
 * place. Everything outside src/contracts can stay ignorant of the distinction.
 */
export const ASSET_TOKEN_MAP: Record<PrimaryAsset, TokenSymbol> = {
  FXRP: 'FXRP',
  FLR: 'WFLR',
  USDT0: 'USDT0',
};

/** The TOKENS[...] config entry backing a given UI-facing PrimaryAsset. */
export function tokenFor(asset: PrimaryAsset): TokenConfig {
  return TOKENS[ASSET_TOKEN_MAP[asset]];
}

function normalizeAddress(address: string): string | null {
  if (!address) return null;
  try {
    return ethers.getAddress(address).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Reverse lookup: an on-chain token address (e.g. from
 * `QpayLedger.primaryAsset(user)`) -> the PrimaryAsset symbol the UI uses.
 * Returns null for the zero address (unset) or any address TOKENS doesn't
 * recognize — callers decide whether that's an error worth surfacing
 * (PrimaryAssetNotSetError / UnknownAssetError) rather than this guessing.
 */
export function assetForTokenAddress(address: string): PrimaryAsset | null {
  const normalized = normalizeAddress(address);
  if (!normalized || normalized === ethers.ZeroAddress.toLowerCase()) return null;

  for (const asset of PRIMARY_ASSETS) {
    const token = tokenFor(asset);
    const tokenAddr = normalizeAddress(token.address);
    if (tokenAddr && tokenAddr === normalized) return asset;
  }
  return null;
}
