import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getSnapshot, subscribe } from '../services/qpayService';
import { QpaySnapshot } from '../services/types';

export type QpayContextValue = {
  /** null only until the very first load resolves. */
  snapshot: QpaySnapshot | null;
  /** True only for the initial load — subsequent background refreshes don't flip this back on. */
  loading: boolean;
  error: Error | null;
  /** Re-reads everything from the service layer. Screens rarely need this directly — mutations already trigger it. */
  refresh: () => Promise<void>;
};

const QpayContext = createContext<QpayContextValue | null>(null);

/**
 * Wraps the app so every screen shares one live copy of Qpay's persisted
 * state. qpayService mutations (pay, redeemFxrp, setPrimaryAsset, ...) call
 * `notify()` internally, which this provider is subscribed to, so a payment
 * made on one screen is reflected immediately on every other mounted screen
 * — no manual refetch wiring needed per screen.
 */
export function QpayProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<QpaySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await getSnapshot();
      setSnapshot(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const value = useMemo<QpayContextValue>(
    () => ({ snapshot, loading, error, refresh }),
    [snapshot, loading, error, refresh],
  );

  return <QpayContext.Provider value={value}>{children}</QpayContext.Provider>;
}

/** Internal — hooks in src/hooks/ build on this. Throws if used outside QpayProvider. */
export function useQpayContext(): QpayContextValue {
  const ctx = useContext(QpayContext);
  if (!ctx) {
    throw new Error('useQpayContext must be used within a <QpayProvider>');
  }
  return ctx;
}
