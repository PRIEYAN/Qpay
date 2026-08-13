import { ethers } from 'ethers';
import { COSTON2 } from '../config/network';

/**
 * A read-only JSON-RPC provider on Coston2. This exists independently of any
 * wallet connection so the app can display on-chain data (balances, oracle
 * reads, ...) before the user connects a wallet, and keep reading it after
 * they disconnect.
 *
 * `staticNetwork` avoids an `eth_chainId` round trip on every call since we
 * already know Qpay only ever talks to Coston2.
 */
export const readOnlyProvider = new ethers.JsonRpcProvider(
  COSTON2.rpcUrl,
  { chainId: COSTON2.chainId, name: 'coston2' },
  { staticNetwork: true },
);
