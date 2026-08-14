import AsyncStorage from '@react-native-async-storage/async-storage';

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
 *                     cache (e.g. from the pre-chain mock build) is dropped
 *                     instead of misread as real data
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

export async function readJSON<T>(key: StorageKey): Promise<T | null> {
  const raw = await AsyncStorage.getItem(NAMESPACE + key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJSON<T>(key: StorageKey, value: T): Promise<void> {
  await AsyncStorage.setItem(NAMESPACE + key, JSON.stringify(value));
}

export async function removeKey(key: StorageKey): Promise<void> {
  await AsyncStorage.removeItem(NAMESPACE + key);
}

export async function clearAllQpayKeys(): Promise<void> {
  await Promise.all(Object.values(STORAGE_KEYS).map((key) => removeKey(key)));
}
