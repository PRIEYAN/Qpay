/**
 * Real Qpay service layer — every exported function signature below is
 * unchanged from the pre-chain mock (so screens/hooks keep compiling
 * untouched), but every implementation now reads/writes Flare Coston2 via
 * ethers, or, where there genuinely is no on-chain analogue (contacts'
 * display names, businesses, payment requests, profile prefs), a small
 * local-only store. Nothing here seeds, invents, or fabricates a balance,
 * transaction, contact, or business — see NOT ALLOWED below.
 *
 *   pay()                    -> QpayLedger.pay(to, amount, ref)
 *   redeemFxrp()              -> QpayGateway.withdrawToXRPL(fxrpAmount, xrplAddress)
 *   getBalance()/
 *   getChainBalances()        -> QpayLedger.balances(user, asset) per TOKENS entry
 *   getPrimaryAsset()         -> QpayLedger.primaryAsset(user)
 *   setPrimaryAsset()         -> QpayLedger.setPrimaryAsset(assetAddress)
 *   getAllTransactions()/
 *   getRecentTransactions()/
 *   searchTransactions()      -> Paid/Deposited/Withdrawn (Ledger) + RedemptionRequested
 *                                 (Gateway) event history, via queryFilter — see txMapping.ts
 *   quoteConversion()         -> QpaySwap.spreadBIPS()/feedOf()/decimalsOf() + QpayOracle.priceOf()
 *                                 (FTSOv2), see pricing.ts
 *   getContacts()/
 *   getRecentContacts()       -> derived from real Paid-event history + locally-saved nicknames
 *   getBusinesses()           -> locally-saved only; no on-chain registry exists
 *   getProfile()              -> connected wallet address + QpayLedger.primaryAsset + local prefs
 *
 * NOT ALLOWED, and not present anywhere below: a seeded contact, a seeded
 * transaction, an invented balance, a fabricated tx hash. When contracts
 * aren't deployed/configured (CONTRACTS.* is ''), or no wallet is connected,
 * reads throw NotConfiguredError/NotConnectedError instead of returning
 * zeros that look like real data.
 */
import { ethers } from 'ethers';
import {
  ASSET_TOKEN_MAP,
  CONTRACTS,
  COSTON2,
  DEPLOY_BLOCK,
  MAX_LOG_BLOCK_RANGE,
  TOKENS,
  assertConfigured,
  assetForTokenAddress,
  computeLotBreakdown,
  fromTokenAmount,
  getAssetManagerForGateway,
  getDefaultProvider,
  getErc20,
  getGateway,
  getLedger,
  toBytes32Ref,
  toTokenAmount,
  tokenFor,
} from '../contracts';
import { generateId } from './ids';
import {
  clearLocalData,
  LocalContact,
  readLocalBusinesses,
  readLocalContacts,
  readLocalProfilePrefs,
  readPaymentRequests,
  readTxCache,
  writeLocalContacts,
  writeLocalProfilePrefs,
  writePaymentRequests,
  writeTxCache,
} from './localData';
// Note: quoteConversion/roundAmount are re-exported further down (from
// './pricing') for screens to import from this module — they are not used
// inside it, so they are deliberately not imported here.
import { resolveRecipient } from './addressResolution';
import {
  AssetResolver,
  buildTransactions,
  ContactResolver,
  RawDepositedLog,
  RawPaidLog,
  RawRedemptionRequestedLog,
  RawWithdrawnLog,
} from './txMapping';
import {
  Balances,
  Business,
  ChainBalance,
  Contact,
  CreatePaymentRequestInput,
  PaymentRequest,
  PaymentRequestStatus,
  PayOptions,
  PRIMARY_ASSETS,
  PrimaryAsset,
  Profile,
  QpaySnapshot,
  RedeemOptions,
  Transaction,
  TransactionFilter,
} from './types';
import {
  BelowLotSizeError,
  InsufficientBalanceError,
  InvalidAmountError,
  NotConnectedError,
  PaymentRequestNotFoundError,
  PaymentRequestNotOpenError,
  PrimaryAssetNotSetError,
  QpayServiceError,
  UnknownAssetError,
  WrongNetworkError,
} from './errors';

// Re-exported so screens/hooks/tests have one import surface for the domain model.
export type {
  Balances,
  Business,
  ChainBalance,
  Contact,
  CreatePaymentRequestInput,
  PaymentRequest,
  PaymentRequestStatus,
  PayOptions,
  PrimaryAsset,
  Profile,
  QpaySnapshot,
  RedeemOptions,
  Transaction,
  TransactionDirection,
  TransactionFilter,
  TransactionStatus,
} from './types';
export { PRIMARY_ASSETS } from './types';
export {
  BelowLotSizeError,
  BelowLotSizeError as InsufficientLotError, // no behaviour change — alias kept out of caution for any external reference; safe to ignore.
  ContactNotFoundError,
  InsufficientBalanceError,
  InvalidAmountError,
  NotConfiguredError,
  NotConnectedError,
  PaymentRequestNotFoundError,
  PaymentRequestNotOpenError,
  PrimaryAssetNotSetError,
  QpayServiceError,
  UnknownAssetError,
  UnknownRecipientError,
  WrongNetworkError,
} from './errors';
export { quoteConversion, roundAmount, refreshPriceCache } from './pricing';
export type { ConversionQuote } from './pricing';

const REDEEM_LOT_SIZE_FALLBACK_DECIMALS = TOKENS.FXRP.decimals; // 6 — used only for formatting, never for the actual on-chain amount.
const MAX_PRIMARY_ASSET_LOOKUPS = 25; // bounds RPC calls when deriving contacts' live primaryAsset.
const MAX_BLOCK_RANGE = MAX_LOG_BLOCK_RANGE; // 30 — Coston2's public RPC rejects any wider eth_getLogs range outright.
const LOG_CHUNK_CONCURRENCY = 8; // in-flight eth_getLogs requests; 30-block chunks means a catch-up is many small calls, not a few big ones.
const MAX_CHUNKS_PER_SCAN = 200; // ~6k blocks (~3h of chain, ~30s of requests) per refresh. Past that we stop and record how far we got, so the next scan resumes instead of blocking the UI for minutes.

// ---------------------------------------------------------------------------
// Wallet context — set by QpayProvider from useWallet(). Every read/write
// below goes through this rather than any module-level "current user" state
// of its own, so the whole service layer reacts the instant the connected
// address or chain changes.
// ---------------------------------------------------------------------------

export type QpayWalletContext = {
  address: string | null;
  chainId: number | null;
  isCorrectChain: boolean;
  getProvider: () => ethers.Provider;
  getSigner: () => Promise<ethers.Signer | null>;
};

let walletCtx: QpayWalletContext = {
  address: null,
  chainId: null,
  isCorrectChain: false,
  getProvider: () => getDefaultProvider(),
  getSigner: async () => null,
};

/** Called by QpayProvider whenever useWallet()'s address/chainId/signer changes. */
export function setWalletContext(ctx: QpayWalletContext): void {
  walletCtx = ctx;
}

function requireAddress(): string {
  if (!walletCtx.address) throw new NotConnectedError();
  return walletCtx.address;
}

async function requireSigner(): Promise<ethers.Signer> {
  requireAddress();
  if (!walletCtx.isCorrectChain) throw new WrongNetworkError(walletCtx.chainId);
  const signer = await walletCtx.getSigner();
  if (!signer) throw new NotConnectedError('Connect a wallet to send this transaction.');
  return signer;
}

function readProvider(): ethers.Provider {
  return walletCtx.getProvider();
}

// ---------------------------------------------------------------------------
// Change notifications — unchanged pattern: any mutation calls notify(),
// QpayProvider is subscribed and re-reads the snapshot.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Subscribe to any mutation. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function shortAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function explorerUrlFor(txHash: string): string {
  return `${COSTON2.explorerUrl}/tx/${txHash}`;
}

function makeAssetResolver(): AssetResolver {
  return (tokenAddress: string) => {
    const symbol = assetForTokenAddress(tokenAddress);
    if (!symbol) return null;
    return { symbol, decimals: tokenFor(symbol).decimals };
  };
}

function makeContactResolver(localContacts: readonly LocalContact[]): ContactResolver {
  return (address: string) => {
    const match = localContacts.find((c) => c.qpayId.toLowerCase() === address.toLowerCase());
    return match ? { id: match.id, name: match.name } : null;
  };
}

/** Reads QpayLedger.primaryAsset(address) and maps it back to a PrimaryAsset — never fabricates a default. */
async function readOnChainPrimaryAsset(ledger: ethers.Contract, address: string): Promise<PrimaryAsset> {
  const raw: string = await ledger.primaryAsset(address);
  if (!raw || raw === ethers.ZeroAddress) throw new PrimaryAssetNotSetError(address);
  const asset = assetForTokenAddress(raw);
  if (!asset) throw new UnknownAssetError(raw);
  return asset;
}

function contactFromLocal(local: LocalContact, lastPaidAt: number | null = null): Contact {
  return {
    id: local.id,
    name: local.name,
    qpayId: local.qpayId,
    lastPaidAt,
    favourite: local.favourite,
    avatarInitial: local.avatarInitial ?? (local.name.charAt(0) || '?').toUpperCase(),
  };
}

function mergeTransactionLists(a: readonly Transaction[], b: readonly Transaction[]): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of a) byId.set(t.id, t);
  for (const t of b) byId.set(t.id, t);
  return Array.from(byId.values()).sort((x, y) => y.timestamp - x.timestamp);
}

async function mergeIntoTxCache(address: string, newRows: Transaction[], atLeastBlock: number): Promise<void> {
  const cache = await readTxCache(COSTON2.chainId, address);
  const merged = mergeTransactionLists(cache?.transactions ?? [], newRows);
  await writeTxCache({
    chainId: COSTON2.chainId,
    address,
    lastScannedBlock: Math.max(cache?.lastScannedBlock ?? -1, atLeastBlock),
    transactions: merged,
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<Profile> {
  assertConfigured();
  const address = requireAddress();
  const [prefs, primaryAsset] = await Promise.all([
    readLocalProfilePrefs(),
    readOnChainPrimaryAsset(getLedger(readProvider()), address),
  ]);

  return {
    username: prefs.username ?? shortAddress(address),
    displayName: prefs.displayName ?? shortAddress(address),
    avatarInitial: (prefs.avatarInitial ?? address.slice(2, 3)).toUpperCase(),
    qpayId: address,
    primaryAsset,
    walletAddress: address,
    xrplAddress: prefs.xrplAddress ?? '',
    onboardingCompleted: prefs.onboardingCompleted ?? false,
    walletConnected: true,
  };
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const localPatch: Record<string, unknown> = {};
  if (patch.username !== undefined) localPatch.username = patch.username;
  if (patch.displayName !== undefined) localPatch.displayName = patch.displayName;
  if (patch.avatarInitial !== undefined) localPatch.avatarInitial = patch.avatarInitial;
  if (patch.xrplAddress !== undefined) localPatch.xrplAddress = patch.xrplAddress;
  if (patch.onboardingCompleted !== undefined) localPatch.onboardingCompleted = patch.onboardingCompleted;
  await writeLocalProfilePrefs(localPatch);
  notify();
  return getProfile();
}

export async function getUsername(): Promise<string> {
  const profile = await getProfile();
  return profile.username;
}

/** Seam: QpayLedger.primaryAsset(user) read. */
export async function getPrimaryAsset(): Promise<PrimaryAsset> {
  assertConfigured();
  const address = requireAddress();
  return readOnChainPrimaryAsset(getLedger(readProvider()), address);
}

/** Seam: QpayLedger.setPrimaryAsset(asset) — a signed transaction. */
export async function setPrimaryAsset(asset: PrimaryAsset): Promise<void> {
  assertConfigured();
  const token = tokenFor(asset);
  if (!token.address) {
    throw new QpayServiceError(
      'ASSET_NOT_CONFIGURED',
      `${asset} (${ASSET_TOKEN_MAP[asset]}) has no configured token address yet — see TOKENS in src/config/network.ts.`,
    );
  }
  const signer = await requireSigner();
  const ledger = getLedger(signer);
  const txResponse = await ledger.setPrimaryAsset(token.address);
  await txResponse.wait();
  notify();
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

async function getBalancesRecord(): Promise<Balances> {
  const address = requireAddress();
  const ledger = getLedger(readProvider());
  const entries = await Promise.all(
    PRIMARY_ASSETS.map(async (asset) => {
      const token = tokenFor(asset);
      // Asset not yet allowlisted on this deployment — truthfully zero (you
      // cannot hold a balance of a token the ledger doesn't support yet),
      // never a placeholder pretending to be a real read.
      if (!token.address) return [asset, 0] as const;
      const raw: bigint = await ledger.balances(address, token.address);
      return [asset, fromTokenAmount(raw, token.decimals)] as const;
    }),
  );
  return Object.fromEntries(entries) as Balances;
}

/** Seam: QpayLedger.balances(user, primaryAsset). */
export async function getBalance(): Promise<{ asset: PrimaryAsset; amount: number }> {
  assertConfigured();
  const address = requireAddress();
  const ledger = getLedger(readProvider());
  const asset = await readOnChainPrimaryAsset(ledger, address);
  const token = tokenFor(asset);
  const raw: bigint = await ledger.balances(address, token.address);
  return { asset, amount: fromTokenAmount(raw, token.decimals) };
}

/**
 * Seam: ERC20.balanceOf(user) for FXRP — the *wallet's* token balance, which
 * is a different number from `getBalance()`'s ledger balance and the one that
 * bounds a deposit. Faucet FXRP lands here; only a deposit moves it into the
 * spendable ledger balance.
 */
export async function getWalletFxrpBalance(): Promise<number> {
  assertConfigured();
  const address = requireAddress();
  const token = TOKENS.FXRP;
  if (!token.address) return 0;
  const raw: bigint = await getErc20(token.address, readProvider()).balanceOf(address);
  return fromTokenAmount(raw, token.decimals);
}

/** Per-asset display metadata. */
export const CHAIN_ASSET_META: Record<PrimaryAsset, { label: string; egressLabel: string }> = {
  FXRP: { label: 'XRP', egressLabel: 'Redeem to XRP Ledger' },
  FLR: { label: 'Flare', egressLabel: 'Send to Flare C-chain address' },
  USDT0: { label: 'USDT', egressLabel: 'Bridge via Stargate (mainnet)' },
};

/** Seam: QpayLedger.balances(user, asset) for every asset in TOKENS. */
export async function getChainBalances(): Promise<ChainBalance[]> {
  assertConfigured();
  const balances = await getBalancesRecord();
  return chainBalancesFrom(balances);
}

/** Pure helper — turns a Balances record into the ChainBalance[] shape, without an async round trip. */
export function chainBalancesFrom(balances: Balances): ChainBalance[] {
  return PRIMARY_ASSETS.map((asset) => ({
    asset,
    label: CHAIN_ASSET_META[asset].label,
    balance: balances[asset],
    egressLabel: CHAIN_ASSET_META[asset].egressLabel,
  }));
}

// ---------------------------------------------------------------------------
// Transaction history — Paid/Deposited/Withdrawn (Ledger) + RedemptionRequested (Gateway)
// ---------------------------------------------------------------------------

/**
 * Splits [fromBlock, toBlock] into MAX_BLOCK_RANGE-sized windows and runs them
 * LOG_CHUNK_CONCURRENCY at a time. Sequential one-at-a-time was fine when the
 * chunk was 30k blocks; at 30 it would make a day of catch-up take minutes of
 * round-trips.
 */
async function queryChunked(
  contract: ethers.Contract,
  filter: ReturnType<ethers.Contract['filters']['Paid']> | any,
  fromBlock: number,
  toBlock: number,
): Promise<ethers.EventLog[]> {
  const windows: Array<[number, number]> = [];
  for (let start = fromBlock; start <= toBlock; start += MAX_BLOCK_RANGE) {
    windows.push([start, Math.min(start + MAX_BLOCK_RANGE - 1, toBlock)]);
  }

  const out: ethers.EventLog[] = [];
  for (let i = 0; i < windows.length; i += LOG_CHUNK_CONCURRENCY) {
    const batch = await Promise.all(
      windows
        .slice(i, i + LOG_CHUNK_CONCURRENCY)
        .map(([start, end]) => contract.queryFilter(filter, start, end)),
    );
    for (const logs of batch) {
      for (const log of logs) {
        if ('args' in log) out.push(log as ethers.EventLog);
      }
    }
  }
  return out;
}

function toRaw<TArgs>(log: ethers.EventLog, argsMap: (args: ethers.Result) => TArgs) {
  return { transactionHash: log.transactionHash, blockNumber: log.blockNumber, index: log.index, args: argsMap(log.args) };
}

async function fetchAndCacheTransactions(address: string): Promise<Transaction[]> {
  const readOnly = readProvider();
  const ledger = getLedger(readOnly);
  const gateway = getGateway(readOnly);

  const cache = await readTxCache(COSTON2.chainId, address);
  const latestBlock = await readOnly.getBlockNumber();
  // Never scan from 0: Qpay's contracts didn't exist before DEPLOY_BLOCK, so
  // everything below it is guaranteed-empty range we'd pay 30 blocks a call for.
  const fromBlock = cache ? Math.max(cache.lastScannedBlock + 1, DEPLOY_BLOCK) : DEPLOY_BLOCK;

  if (fromBlock > latestBlock) {
    return cache?.transactions ?? [];
  }

  // Bounded window per refresh. `scanTo` — not `latestBlock` — is what gets
  // recorded as scanned below, so a capped scan resumes exactly where it
  // stopped rather than skipping the blocks it never looked at.
  const scanTo = Math.min(latestBlock, fromBlock + MAX_BLOCK_RANGE * MAX_CHUNKS_PER_SCAN - 1);

  const [paidFrom, paidTo, deposited, withdrawn, redemptions] = await Promise.all([
    queryChunked(ledger, ledger.filters.Paid(address), fromBlock, scanTo),
    queryChunked(ledger, ledger.filters.Paid(undefined, address), fromBlock, scanTo),
    queryChunked(ledger, ledger.filters.Deposited(address), fromBlock, scanTo),
    queryChunked(ledger, ledger.filters.Withdrawn(address), fromBlock, scanTo),
    queryChunked(gateway, gateway.filters.RedemptionRequested(address), fromBlock, scanTo),
  ]);

  const paidLogs: RawPaidLog[] = [...paidFrom, ...paidTo].map((log) =>
    toRaw(log, (a) => ({
      from: a.from,
      to: a.to,
      assetIn: a.assetIn,
      amountIn: a.amountIn,
      assetOut: a.assetOut,
      amountOut: a.amountOut,
      ref: a.ref,
    })),
  );
  const depositedLogs: RawDepositedLog[] = deposited.map((log) =>
    toRaw(log, (a) => ({ user: a.user, asset: a.asset, amount: a.amount })),
  );
  const withdrawnLogs: RawWithdrawnLog[] = withdrawn.map((log) =>
    toRaw(log, (a) => ({ user: a.user, asset: a.asset, amount: a.amount })),
  );
  const redemptionLogs: RawRedemptionRequestedLog[] = redemptions.map((log) =>
    toRaw(log, (a) => ({ user: a.user, xrplAddress: a.xrplAddress, redeemedUBA: a.redeemedUBA })),
  );

  const blockNumbers = new Set<number>();
  for (const l of [...paidLogs, ...depositedLogs, ...withdrawnLogs, ...redemptionLogs]) blockNumbers.add(l.blockNumber);
  const blockTimestamps = new Map<number, number>();
  await Promise.all(
    Array.from(blockNumbers).map(async (bn) => {
      const block = await readOnly.getBlock(bn);
      blockTimestamps.set(bn, (block?.timestamp ?? 0) * 1000);
    }),
  );

  const localContacts = await readLocalContacts();
  const newRows = buildTransactions({
    me: address,
    paid: paidLogs,
    deposited: depositedLogs,
    withdrawn: withdrawnLogs,
    redemptions: redemptionLogs,
    fxrpDecimals: REDEEM_LOT_SIZE_FALLBACK_DECIMALS,
    resolveAsset: makeAssetResolver(),
    resolveContact: makeContactResolver(localContacts),
    blockTimestamps,
    explorerUrl: explorerUrlFor,
  });

  const merged = mergeTransactionLists(cache?.transactions ?? [], newRows);
  await writeTxCache({ chainId: COSTON2.chainId, address, lastScannedBlock: scanTo, transactions: merged });
  return merged;
}

async function loadTransactions(): Promise<Transaction[]> {
  assertConfigured();
  const address = requireAddress();
  return fetchAndCacheTransactions(address);
}

export async function getRecentTransactions(limit = 5): Promise<Transaction[]> {
  const rows = await loadTransactions();
  return rows.slice(0, limit);
}

export async function getAllTransactions(): Promise<Transaction[]> {
  return loadTransactions();
}

/** Pure helper — filters by direction/status/asset and full-text searches counterparty+note+ref. */
export function filterTransactions(transactions: Transaction[], filter: TransactionFilter = {}): Transaction[] {
  const query = filter.query?.trim().toLowerCase();

  return transactions.filter((tx) => {
    if (filter.direction && tx.direction !== filter.direction) return false;
    if (filter.status && tx.status !== filter.status) return false;
    if (filter.asset && tx.asset !== filter.asset && tx.assetOut !== filter.asset) return false;
    if (query) {
      const haystack = `${tx.counterparty} ${tx.note ?? ''} ${tx.ref}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export async function searchTransactions(filter: TransactionFilter = {}): Promise<Transaction[]> {
  const rows = await loadTransactions();
  return filterTransactions(rows, filter);
}

// ---------------------------------------------------------------------------
// Contacts — derived from real Paid-event history, plus local nicknames
// ---------------------------------------------------------------------------

async function deriveContacts(transactions: readonly Transaction[]): Promise<Contact[]> {
  const localContacts = await readLocalContacts();

  const lastPaidByAddress = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.direction !== 'sent' || !tx.counterpartyAddress) continue;
    const key = tx.counterpartyAddress.toLowerCase();
    const prev = lastPaidByAddress.get(key);
    if (prev === undefined || tx.timestamp > prev) lastPaidByAddress.set(key, tx.timestamp);
  }

  const byAddress = new Map<string, Contact>();

  for (const local of localContacts) {
    const key = local.qpayId.toLowerCase();
    byAddress.set(key, contactFromLocal(local, lastPaidByAddress.get(key) ?? null));
  }

  for (const [key, lastPaidAt] of lastPaidByAddress) {
    if (byAddress.has(key)) continue;
    let checksummed = key;
    try {
      checksummed = ethers.getAddress(key);
    } catch {
      // leave as the lowercase form if it somehow isn't a valid address
    }
    byAddress.set(key, {
      id: `addr-${key}`,
      name: shortAddress(checksummed),
      qpayId: checksummed,
      lastPaidAt,
      favourite: false,
      avatarInitial: (checksummed.slice(2, 3) || '#').toUpperCase(),
    });
  }

  const contacts = Array.from(byAddress.values());
  const bounded = contacts.slice(0, MAX_PRIMARY_ASSET_LOOKUPS);
  const rest = contacts.slice(MAX_PRIMARY_ASSET_LOOKUPS);

  const ledger = getLedger(readProvider());
  const withAsset = await Promise.all(
    bounded.map(async (c) => {
      try {
        const raw: string = await ledger.primaryAsset(c.qpayId);
        const asset = assetForTokenAddress(raw);
        return asset ? { ...c, primaryAsset: asset } : c;
      } catch {
        return c; // best-effort — leave primaryAsset undefined rather than fail the whole list.
      }
    }),
  );

  return [...withAsset, ...rest];
}

async function loadContactsFull(): Promise<Contact[]> {
  assertConfigured();
  requireAddress();
  const transactions = await loadTransactions();
  return deriveContacts(transactions);
}

export async function getContacts(): Promise<Contact[]> {
  const contacts = await loadContactsFull();
  return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
}

/** Contacts ordered by most-recently-paid first; never-paid contacts are excluded. */
export async function getRecentContacts(limit = 8): Promise<Contact[]> {
  const contacts = await loadContactsFull();
  const paid = contacts.filter((c) => c.lastPaidAt != null);
  paid.sort((a, b) => (b.lastPaidAt as number) - (a.lastPaidAt as number));
  return paid.slice(0, limit);
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const contacts = await loadContactsFull();
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.qpayId.toLowerCase().includes(q));
}

export type AddContactInput = {
  name: string;
  qpayId: string;
  avatarInitial?: string;
  favourite?: boolean;
  primaryAsset?: PrimaryAsset;
};

/** Saves a local nickname over a real wallet address. Idempotent on the address. */
export async function addContact(input: AddContactInput): Promise<Contact> {
  const trimmed = input.qpayId.trim();
  if (!ethers.isAddress(trimmed)) {
    throw new QpayServiceError('INVALID_ADDRESS', `"${input.qpayId}" isn't a valid wallet address.`);
  }
  const address = ethers.getAddress(trimmed);
  const localContacts = await readLocalContacts();
  const existing = localContacts.find((c) => c.qpayId.toLowerCase() === address.toLowerCase());
  if (existing) return contactFromLocal(existing);

  const name = input.name.trim() || shortAddress(address);
  const local: LocalContact = {
    id: generateId('contact'),
    qpayId: address,
    name,
    avatarInitial: (input.avatarInitial ?? name.charAt(0) ?? '?').toUpperCase(),
    favourite: input.favourite ?? false,
  };
  await writeLocalContacts([...localContacts, local]);
  notify();
  return contactFromLocal(local);
}

export async function toggleFavouriteContact(id: string): Promise<Contact> {
  const localContacts = await readLocalContacts();
  const idx = localContacts.findIndex((c) => c.id === id);

  if (idx !== -1) {
    const updated: LocalContact = { ...localContacts[idx], favourite: !localContacts[idx].favourite };
    await writeLocalContacts([...localContacts.slice(0, idx), updated, ...localContacts.slice(idx + 1)]);
    notify();
    return contactFromLocal(updated);
  }

  // Not a saved contact yet — must be a chain-derived one (id `addr-...`).
  // Favouriting it promotes it into the local store.
  const derived = await loadContactsFull();
  const match = derived.find((c) => c.id === id);
  if (!match) throw new QpayServiceError('CONTACT_NOT_FOUND', `Contact "${id}" not found`);

  const promoted: LocalContact = {
    id: generateId('contact'),
    qpayId: match.qpayId,
    name: match.name,
    avatarInitial: match.avatarInitial,
    favourite: true,
  };
  await writeLocalContacts([...localContacts, promoted]);
  notify();
  return contactFromLocal(promoted, match.lastPaidAt);
}

// ---------------------------------------------------------------------------
// Businesses — no on-chain registry. Local-saved only; empty by default.
// ---------------------------------------------------------------------------

export async function getBusinesses(): Promise<Business[]> {
  return readLocalBusinesses();
}

// ---------------------------------------------------------------------------
// Payment requests — no on-chain analogue (QpayLedger has no invoice
// bookkeeping). Local "collect request" records, fulfilled by a real pay().
// ---------------------------------------------------------------------------

export async function requestMoney(input: CreatePaymentRequestInput = {}): Promise<PaymentRequest> {
  const address = requireAddress();
  const asset = input.asset ?? (await getPrimaryAsset());
  const request: PaymentRequest = {
    id: generateId('req'),
    fromQpayId: address,
    amount: input.amount,
    asset,
    ref: input.ref,
    note: input.note,
    status: 'open',
    createdAt: Date.now(),
    expiresAt: input.expiresAt,
  };

  const requests = await readPaymentRequests();
  await writePaymentRequests([request, ...requests]);
  notify();
  return request;
}

export async function getPaymentRequests(status?: PaymentRequestStatus): Promise<PaymentRequest[]> {
  const requests = await readPaymentRequests();
  return status ? requests.filter((r) => r.status === status) : requests;
}

export async function cancelPaymentRequest(id: string): Promise<PaymentRequest> {
  const requests = await readPaymentRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) throw new PaymentRequestNotFoundError(id);
  if (requests[idx].status !== 'open') throw new PaymentRequestNotOpenError(id);

  const updated: PaymentRequest = { ...requests[idx], status: 'cancelled' };
  await writePaymentRequests([...requests.slice(0, idx), updated, ...requests.slice(idx + 1)]);
  notify();
  return updated;
}

/**
 * Looks for a real received payment whose `ref` matches this request, and
 * marks the request paid against it. There is no on-chain invoice registry
 * to "settle" — this only ever records a REAL transaction that already
 * happened; it never fabricates one. Throws if no matching payment has
 * landed yet.
 */
export async function markPaymentRequestPaid(
  id: string,
  opts?: { fromQpayId?: string },
): Promise<{ request: PaymentRequest; transaction: Transaction }> {
  const requests = await readPaymentRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) throw new PaymentRequestNotFoundError(id);
  const reqRow = requests[idx];
  if (reqRow.status !== 'open') throw new PaymentRequestNotOpenError(id);

  const transactions = await loadTransactions();
  const match = transactions.find(
    (t) =>
      t.direction === 'received' &&
      (!reqRow.ref || t.ref === reqRow.ref) &&
      (!opts?.fromQpayId ||
        (t.counterpartyAddress && t.counterpartyAddress.toLowerCase() === opts.fromQpayId.toLowerCase())),
  );

  if (!match) {
    throw new QpayServiceError(
      'REQUEST_NOT_YET_PAID',
      `No matching payment found on-chain yet for this request (ref "${reqRow.ref ?? id}"). Ask them to pay, then try again.`,
    );
  }

  const updated: PaymentRequest = { ...reqRow, status: 'paid', paidTxId: match.id };
  await writePaymentRequests([...requests.slice(0, idx), updated, ...requests.slice(idx + 1)]);
  notify();
  return { request: updated, transaction: match };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

function parseReceiptLogs(
  receipt: ethers.TransactionReceipt,
  contract: ethers.Contract,
  eventName: string,
): { transactionHash: string; blockNumber: number; index: number; args: ethers.Result }[] {
  const address = String(contract.target).toLowerCase();
  const out: { transactionHash: string; blockNumber: number; index: number; args: ethers.Result }[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address) continue;
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed && parsed.name === eventName) {
        out.push({ transactionHash: log.transactionHash, blockNumber: log.blockNumber, index: log.index, args: parsed.args });
      }
    } catch {
      // Not this event (or not decodable by this ABI) — skip.
    }
  }
  return out;
}

/**
 * Seam: QpayLedger.pay(to, amount, ref) — a signed transaction. Resolves
 * `to` to a real address (§3 — direct 0x address, or a locally-saved
 * contact; throws UnknownRecipientError otherwise). Throws
 * InsufficientBalanceError / InvalidAmountError exactly as before. The
 * returned Transaction's assetOut/amountOut (when the payment crossed
 * assets) come from the real emitted Paid event, not a client-side estimate.
 */
export async function pay(to: string, amount: number, ref: string, opts?: PayOptions): Promise<Transaction> {
  assertConfigured();
  if (!(amount > 0)) throw new InvalidAmountError();

  const myAddress = requireAddress();
  const localContacts = await readLocalContacts();
  const resolved = resolveRecipient(to, localContacts); // throws UnknownRecipientError

  const readOnly = readProvider();
  const ledgerRead = getLedger(readOnly);
  const senderAsset = await readOnChainPrimaryAsset(ledgerRead, myAddress);
  const senderToken = tokenFor(senderAsset);
  if (!senderToken.address) {
    throw new QpayServiceError('ASSET_NOT_CONFIGURED', `${senderAsset} has no configured token address yet.`);
  }

  const amountRaw = toTokenAmount(amount, senderToken.decimals);
  const availableRaw: bigint = await ledgerRead.balances(myAddress, senderToken.address);
  if (availableRaw < amountRaw) {
    throw new InsufficientBalanceError(senderAsset, amount, fromTokenAmount(availableRaw, senderToken.decimals));
  }

  const signer = await requireSigner();
  const ledger = getLedger(signer);
  const refBytes32 = toBytes32Ref(ref);

  const txResponse = await ledger.pay(resolved.address, amountRaw, refBytes32);
  const receipt: ethers.TransactionReceipt | null = await txResponse.wait();
  if (!receipt || receipt.status !== 1) {
    throw new QpayServiceError('TX_FAILED', `Payment transaction failed (${receipt?.hash ?? txResponse.hash}).`);
  }

  const paidLogs = parseReceiptLogs(receipt, ledger, 'Paid');
  const block = await readOnly.getBlock(receipt.blockNumber);
  const timestamp = (block?.timestamp ?? Math.floor(Date.now() / 1000)) * 1000;

  const rows = buildTransactions({
    me: myAddress,
    paid: paidLogs.map((l) => ({
      transactionHash: l.transactionHash,
      blockNumber: l.blockNumber,
      index: l.index,
      args: {
        from: l.args.from,
        to: l.args.to,
        assetIn: l.args.assetIn,
        amountIn: l.args.amountIn,
        assetOut: l.args.assetOut,
        amountOut: l.args.amountOut,
        ref: l.args.ref,
      },
    })),
    deposited: [],
    withdrawn: [],
    redemptions: [],
    fxrpDecimals: TOKENS.FXRP.decimals,
    resolveAsset: makeAssetResolver(),
    resolveContact: makeContactResolver(localContacts),
    blockTimestamps: new Map([[receipt.blockNumber, timestamp]]),
    explorerUrl: explorerUrlFor,
  });

  const built = rows[0];
  if (!built) {
    throw new QpayServiceError('TX_FAILED', 'Payment succeeded on-chain but its Paid event could not be parsed.');
  }
  const tx: Transaction = opts?.note ? { ...built, note: opts.note } : built;

  await mergeIntoTxCache(myAddress, [tx], receipt.blockNumber);
  notify();
  return tx;
}

/**
 * Seam: ERC20.approve + QpayLedger.deposit(asset, amount) — the ingress half
 * of the ledger, and the only way a balance ever becomes non-zero from the
 * app. Without it the wallet can hold faucet FXRP forever while every payment
 * fails on an empty ledger balance.
 *
 * Two transactions when the ledger's allowance is short, one when it isn't:
 * `deposit()` pulls via `safeTransferFrom`, so the ledger must be approved
 * first. The approval is for exactly this deposit rather than the unbounded
 * MaxUint256 — a payments app should not leave a standing infinite allowance
 * on a contract it also asks you to trust with custody.
 */
export async function depositFxrp(amount: number): Promise<Transaction> {
  assertConfigured();
  if (!(amount > 0)) throw new InvalidAmountError();

  const myAddress = requireAddress();
  const readOnly = readProvider();
  const fxrpToken = TOKENS.FXRP;
  if (!fxrpToken.address) {
    throw new QpayServiceError('ASSET_NOT_CONFIGURED', 'FXRP has no configured token address yet.');
  }

  const amountRaw = toTokenAmount(amount, fxrpToken.decimals);

  // Wallet-held FXRP, not the ledger balance — this is the one screen where
  // those two differ and the distinction is the whole point.
  const tokenRead = getErc20(fxrpToken.address, readOnly);
  const walletRaw: bigint = await tokenRead.balanceOf(myAddress);
  if (walletRaw < amountRaw) {
    throw new InsufficientBalanceError(
      'FXRP',
      amount,
      fromTokenAmount(walletRaw, fxrpToken.decimals),
    );
  }

  const signer = await requireSigner();
  const ledger = getLedger(signer);
  const ledgerAddress = CONTRACTS.qpayLedger;

  const allowanceRaw: bigint = await tokenRead.allowance(myAddress, ledgerAddress);
  if (allowanceRaw < amountRaw) {
    const tokenWrite = getErc20(fxrpToken.address, signer);
    const approveTx = await tokenWrite.approve(ledgerAddress, amountRaw);
    const approveReceipt: ethers.TransactionReceipt | null = await approveTx.wait();
    if (!approveReceipt || approveReceipt.status !== 1) {
      throw new QpayServiceError(
        'TX_FAILED',
        `FXRP approval failed (${approveReceipt?.hash ?? approveTx.hash}).`,
      );
    }
  }

  const txResponse = await ledger.deposit(fxrpToken.address, amountRaw);
  const receipt: ethers.TransactionReceipt | null = await txResponse.wait();
  if (!receipt || receipt.status !== 1) {
    throw new QpayServiceError('TX_FAILED', `Deposit transaction failed (${receipt?.hash ?? txResponse.hash}).`);
  }

  const depositLogs = parseReceiptLogs(receipt, getLedger(readOnly), 'Deposited');
  const block = await readOnly.getBlock(receipt.blockNumber);
  const timestamp = (block?.timestamp ?? Math.floor(Date.now() / 1000)) * 1000;

  const rows = buildTransactions({
    me: myAddress,
    paid: [],
    withdrawn: [],
    redemptions: [],
    deposited: depositLogs.map((l) => ({
      transactionHash: l.transactionHash,
      blockNumber: l.blockNumber,
      index: l.index,
      args: { user: l.args.user, asset: l.args.asset, amount: l.args.amount },
    })),
    fxrpDecimals: fxrpToken.decimals,
    resolveAsset: makeAssetResolver(),
    resolveContact: () => null,
    blockTimestamps: new Map([[receipt.blockNumber, timestamp]]),
    explorerUrl: explorerUrlFor,
  });

  const tx = rows[0];
  if (!tx) {
    throw new QpayServiceError('TX_FAILED', 'Deposit succeeded on-chain but its event could not be parsed.');
  }

  await mergeIntoTxCache(myAddress, [tx], receipt.blockNumber);
  notify();
  return tx;
}

/**
 * Seam: QpayGateway.withdrawToXRPL(fxrpAmount, xrplAddress) — a signed
 * transaction. Lot size is read live from the AssetManager, never
 * hardcoded. `opts.simulatePartialFill` is accepted for signature
 * compatibility with the UI's demo toggle but has no effect — real partial
 * fills are detected from the transaction's own emitted events, never
 * simulated (see txMapping.ts's redemption/refund cross-reference).
 */
/**
 * The live FAssets lot size for FXRP, in display units.
 *
 * Redemption always burns whole lots, so the UI has to know the boundary
 * *before* the user commits to an amount — otherwise the only feedback is a
 * BelowLotSizeError after the fact. Read from the chain
 * (`AssetManager.lotSize()` via `QpayGateway.assetManager()`) exactly like
 * `redeemFxrp` does, never hardcoded: Coston2's 10 FXRP/lot is not
 * guaranteed to match mainnet or to stay constant.
 */
export async function getFxrpLotSize(): Promise<number> {
  const fxrpToken = TOKENS.FXRP;
  if (!fxrpToken.address) {
    throw new QpayServiceError('ASSET_NOT_CONFIGURED', 'FXRP has no configured token address yet.');
  }
  const assetManager = await getAssetManagerForGateway(readProvider());
  const lotSizeRaw: bigint = await assetManager.lotSize();
  return fromTokenAmount(lotSizeRaw, fxrpToken.decimals);
}

export async function redeemFxrp(amount: number, xrplAddress: string, opts?: RedeemOptions): Promise<Transaction> {
  assertConfigured();
  if (!(amount > 0)) throw new InvalidAmountError();
  const trimmedXrpl = xrplAddress.trim();
  if (!trimmedXrpl) {
    throw new QpayServiceError('INVALID_XRPL_ADDRESS', 'Enter a destination XRPL address.');
  }
  if (opts?.simulatePartialFill) {
    // eslint-disable-next-line no-console
    console.warn(
      'redeemFxrp: simulatePartialFill has no effect against the real chain — partial fills are now ' +
        'detected from the actual transaction receipt, never simulated.',
    );
  }

  const myAddress = requireAddress();
  const readOnly = readProvider();
  const fxrpToken = TOKENS.FXRP;
  if (!fxrpToken.address) {
    throw new QpayServiceError('ASSET_NOT_CONFIGURED', 'FXRP has no configured token address yet.');
  }

  const assetManager = await getAssetManagerForGateway(readOnly);
  const lotSizeRaw: bigint = await assetManager.lotSize();
  const lotSize = fromTokenAmount(lotSizeRaw, fxrpToken.decimals);

  const { lots } = computeLotBreakdown(amount, lotSize);
  if (lots < 1) throw new BelowLotSizeError(amount, lotSize);
  const exactRaw = lotSizeRaw * BigInt(lots); // exact bigint multiple — never re-derived from a float.

  const ledgerRead = getLedger(readOnly);
  const balanceRaw: bigint = await ledgerRead.balances(myAddress, fxrpToken.address);
  if (balanceRaw < exactRaw) {
    throw new InsufficientBalanceError(
      'FXRP',
      fromTokenAmount(exactRaw, fxrpToken.decimals),
      fromTokenAmount(balanceRaw, fxrpToken.decimals),
    );
  }

  const signer = await requireSigner();
  const gateway = getGateway(signer);
  const txResponse = await gateway.withdrawToXRPL(exactRaw, trimmedXrpl);
  const receipt: ethers.TransactionReceipt | null = await txResponse.wait();
  if (!receipt || receipt.status !== 1) {
    throw new QpayServiceError('TX_FAILED', `Redemption transaction failed (${receipt?.hash ?? txResponse.hash}).`);
  }

  const redemptionLogs = parseReceiptLogs(receipt, gateway, 'RedemptionRequested');
  const ledgerForLogs = getLedger(readOnly);
  const depositLogs = parseReceiptLogs(receipt, ledgerForLogs, 'Deposited');

  const block = await readOnly.getBlock(receipt.blockNumber);
  const timestamp = (block?.timestamp ?? Math.floor(Date.now() / 1000)) * 1000;

  const rows = buildTransactions({
    me: myAddress,
    paid: [],
    withdrawn: [],
    deposited: depositLogs.map((l) => ({
      transactionHash: l.transactionHash,
      blockNumber: l.blockNumber,
      index: l.index,
      args: { user: l.args.user, asset: l.args.asset, amount: l.args.amount },
    })),
    redemptions: redemptionLogs.map((l) => ({
      transactionHash: l.transactionHash,
      blockNumber: l.blockNumber,
      index: l.index,
      args: { user: l.args.user, xrplAddress: l.args.xrplAddress, redeemedUBA: l.args.redeemedUBA },
    })),
    fxrpDecimals: fxrpToken.decimals,
    resolveAsset: makeAssetResolver(),
    resolveContact: () => null,
    blockTimestamps: new Map([[receipt.blockNumber, timestamp]]),
    explorerUrl: explorerUrlFor,
  });

  const tx = rows[0];
  if (!tx) {
    throw new QpayServiceError('TX_FAILED', 'Redemption succeeded on-chain but its event could not be parsed.');
  }

  await mergeIntoTxCache(myAddress, [tx], receipt.blockNumber);
  notify();
  return tx;
}

// ---------------------------------------------------------------------------
// Snapshot — everything QpayProvider needs in one read.
// ---------------------------------------------------------------------------

export async function getSnapshot(): Promise<QpaySnapshot> {
  assertConfigured();
  requireAddress();

  const [profile, balances, transactions] = await Promise.all([
    getProfile(),
    getBalancesRecord(),
    loadTransactions(),
  ]);
  const [contactsRaw, businesses, paymentRequests] = await Promise.all([
    deriveContacts(transactions),
    readLocalBusinesses(),
    readPaymentRequests(),
  ]);

  return {
    profile,
    balances,
    contacts: [...contactsRaw].sort((a, b) => a.name.localeCompare(b.name)),
    businesses,
    transactions,
    paymentRequests,
  };
}

/** Clears every locally-stored record (contacts, prefs, requests, tx cache). Never touches the chain — "reset" no longer means "reseed fake data." */
export async function resetDemoData(): Promise<void> {
  await clearLocalData();
  notify();
}
