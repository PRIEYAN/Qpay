/**
 * Web port of the mobile storage adapter.
 *
 * The mobile app backed this with `@react-native-async-storage/async-storage`;
 * on the web the equivalent durable, synchronous-per-origin store is
 * `localStorage`. The exported API is deliberately kept async and
 * byte-for-byte identical to the mobile module's, so every consumer
 * (localData.ts, qpayService.ts) compiles and behaves unchanged.
 */

/** Every key this service layer touches lives under this namespace. */
export const NAMESPACE = '@qpay/';

/**
 * Genuinely-local data only (task requirement: "no mock or any data" — every
 * balance/transaction/contact must come from the chain or the user's own
 * real activity). What's allowed to live here:
 *   - localProfile   user-chosen display name/avatar/XRPL address
 *   - localContacts  user-added contact nicknames (name <-> address)
 *   - localBusinesses  user-saved merchant entries (there is no on-chain registry)
 *   - paymentRequests  local "collect request" records (no on-chain analogue)
 *   - txCache        a cache of chain-derived transactions, keyed by chain+address,
 *                     so getAllTransactions() doesn't re-scan from block 0 every call
 *   - schemaVersion   bumped whenever the shape of the above changes, so an old
 *                     cache is dropped instead of misread as real data
 */
export const STORAGE_KEYS = {
  localProfile: 'localProfile',
  localContacts: 'localContacts',
  localBusinesses: 'localBusinesses',
  paymentRequests: 'paymentRequests',
  txCache: 'txCache',
  schemaVersion: 'schemaVersion',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * `localStorage` throws rather than returning null in a few real situations
 * — Safari private mode, storage disabled by policy, quota exhausted on
 * write. None of those are a reason to break a payment flow, so reads
 * degrade to null and writes are best-effort.
 */
function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function readJSON<T>(key: StorageKey): Promise<T | null> {
  const store = safeLocalStorage();
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(NAMESPACE + key);
  } catch {
    return null;
  }
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJSON<T>(key: StorageKey, value: T): Promise<void> {
  const store = safeLocalStorage();
  if (!store) return;
  try {
    store.setItem(NAMESPACE + key, JSON.stringify(value));
  } catch {
    // Quota exceeded / storage disabled — the tx cache is the only large
    // writer here and it is always re-derivable from the chain.
  }
}

export async function removeKey(key: StorageKey): Promise<void> {
  const store = safeLocalStorage();
  if (!store) return;
  try {
    store.removeItem(NAMESPACE + key);
  } catch {
    // Nothing actionable.
  }
}

export async function clearAllQpayKeys(): Promise<void> {
  await Promise.all(Object.values(STORAGE_KEYS).map((key) => removeKey(key)));
}
