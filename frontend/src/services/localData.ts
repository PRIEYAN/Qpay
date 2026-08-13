/**
 * The only genuinely-local state Qpay keeps (task requirement: "no mock or
 * any data"). Everything here is either something the user typed/chose on
 * this device, or a cache of chain data that's re-derivable at any time —
 * never a fabricated balance, transaction, contact, or business.
 */
import { Business, PaymentRequest, Transaction } from './types';
import { clearAllQpayKeys, readJSON, STORAGE_KEYS, writeJSON } from './storage';

/** Bump whenever the shape of local records below changes — old/mock-era caches get dropped, never misread as real. */
const SCHEMA_VERSION = 1;

export type LocalProfilePrefs = {
  username?: string;
  displayName?: string;
  avatarInitial?: string;
  /** User-supplied XRPL redemption address. Never invented. */
  xrplAddress?: string;
  onboardingCompleted?: boolean;
};

/** A user-added nickname over a real wallet address — never a seeded/fake person. */
export type LocalContact = {
  id: string;
  /** Checksummed wallet address. */
  qpayId: string;
  name: string;
  avatarInitial?: string;
  favourite: boolean;
};

let schemaChecked = false;

async function ensureSchema(): Promise<void> {
  if (schemaChecked) return;
  schemaChecked = true;
  const version = await readJSON<number>(STORAGE_KEYS.schemaVersion);
  if (version !== SCHEMA_VERSION) {
    // Anything under the old keys was the pre-chain mock's seeded snapshot
    // (or a stale shape) — clear it rather than ever surfacing it as real.
    await clearAllQpayKeys();
    await writeJSON(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
  }
}

// ---- profile prefs ----------------------------------------------------

export async function readLocalProfilePrefs(): Promise<LocalProfilePrefs> {
  await ensureSchema();
  return (await readJSON<LocalProfilePrefs>(STORAGE_KEYS.localProfile)) ?? {};
}

export async function writeLocalProfilePrefs(patch: Partial<LocalProfilePrefs>): Promise<LocalProfilePrefs> {
  const next = { ...(await readLocalProfilePrefs()), ...patch };
  await writeJSON(STORAGE_KEYS.localProfile, next);
  return next;
}

// ---- contacts -----------------------------------------------------------

export async function readLocalContacts(): Promise<LocalContact[]> {
  await ensureSchema();
  return (await readJSON<LocalContact[]>(STORAGE_KEYS.localContacts)) ?? [];
}

export async function writeLocalContacts(contacts: LocalContact[]): Promise<void> {
  await writeJSON(STORAGE_KEYS.localContacts, contacts);
}

// ---- businesses -----------------------------------------------------------
// No on-chain merchant registry exists. This is *only* ever what the user
// explicitly saved — there is currently no add-business UI, so in practice
// this stays empty, and getBusinesses() returns [] honestly rather than
// inventing merchants.

export async function readLocalBusinesses(): Promise<Business[]> {
  await ensureSchema();
  return (await readJSON<Business[]>(STORAGE_KEYS.localBusinesses)) ?? [];
}

export async function writeLocalBusinesses(businesses: Business[]): Promise<void> {
  await writeJSON(STORAGE_KEYS.localBusinesses, businesses);
}

// ---- payment requests -----------------------------------------------------
// No on-chain analogue (QpayLedger has no invoice bookkeeping) — a local
// "collect request," same idea as a UPI collect request: real intent the
// user created, fulfilled later by a real pay().

export async function readPaymentRequests(): Promise<PaymentRequest[]> {
  await ensureSchema();
  return (await readJSON<PaymentRequest[]>(STORAGE_KEYS.paymentRequests)) ?? [];
}

export async function writePaymentRequests(requests: PaymentRequest[]): Promise<void> {
  await writeJSON(STORAGE_KEYS.paymentRequests, requests);
}

// ---- transaction cache ----------------------------------------------------
// A cache of chain-derived transactions, keyed by chain+address, so
// getAllTransactions() only has to scan new blocks since the last read
// instead of re-querying from block 0 every time. Clearly a cache, not a
// source of truth — always safe to drop.

export type TxCacheEntry = {
  chainId: number;
  address: string;
  /** Highest block number already scanned for this address. */
  lastScannedBlock: number;
  /** Newest-first. */
  transactions: Transaction[];
};

function txCacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export async function readTxCache(chainId: number, address: string): Promise<TxCacheEntry | null> {
  await ensureSchema();
  const all = (await readJSON<Record<string, TxCacheEntry>>(STORAGE_KEYS.txCache)) ?? {};
  return all[txCacheKey(chainId, address)] ?? null;
}

export async function writeTxCache(entry: TxCacheEntry): Promise<void> {
  const all = (await readJSON<Record<string, TxCacheEntry>>(STORAGE_KEYS.txCache)) ?? {};
  all[txCacheKey(entry.chainId, entry.address)] = entry;
  await writeJSON(STORAGE_KEYS.txCache, all);
}

// ---- reset ------------------------------------------------------------

/** Clears every locally-stored record (contacts, prefs, requests, tx cache). Never touches the chain. */
export async function clearLocalData(): Promise<void> {
  schemaChecked = false;
  await clearAllQpayKeys();
  await writeJSON(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
}
