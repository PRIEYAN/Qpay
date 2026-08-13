import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getSnapshot,
  refreshPriceCache,
  setWalletContext,
  subscribe,
} from '../services/qpayService';
import type { QpaySnapshot } from '../services/types';
import { readOnlyProvider, useWallet } from '../web3';

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
 *
 * It is also the single place that pushes wallet state *into* the service
 * layer via `setWalletContext()`. qpayService keeps no "current user" state
 * of its own, so without this the whole app would read as permanently
 * disconnected no matter what the wallet reported.
 */
export function QpayProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [snapshot, setSnapshot] = useState<QpaySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedOnce = useRef(false);

  const { address, chainId, isCorrectChain, getProvider, getSigner } = wallet;

  // Push wallet state down before any read runs. This is a layout effect in
  // spirit — it must land before the refresh below fires, which the
  // dependency ordering guarantees since both run in the same commit.
  useEffect(() => {
    setWalletContext({ address, chainId, isCorrectChain, getProvider, getSigner });
  }, [address, chainId, isCorrectChain, getProvider, getSigner]);

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
    void refresh();
    const unsubscribe = subscribe(() => {
      void refresh();
    });
    return unsubscribe;
    // `address` is in the dep list so switching accounts re-reads everything
    // for the new user rather than showing the previous account's data.
  }, [refresh, address, isCorrectChain]);

  /**
   * Prime the FTSOv2 price cache that `quoteConversion()` reads.
   *
   * That quote has to be synchronous (it runs inside SendScreen's render),
   * so it can only report a cross-asset rate that something already fetched
   * — with an unprimed cache every cross-asset send renders "They receive
   * 0.00". Nothing called this before, so it is done here, once, in the one
   * provider every screen already sits under.
   *
   * It runs off the read-only provider: prices are public chain state and
   * must be available before a wallet connects. Failures are non-fatal —
   * `quoteConversion` already degrades to `stale: true` rather than
   * inventing a rate.
   */
  useEffect(() => {
    let cancelled = false;
    const prime = () => {
      refreshPriceCache(readOnlyProvider).catch(() => {
        // Oracle unreachable or not configured — the quote reports itself
        // stale, which is the honest outcome.
      });
    };
    prime();

    // Feeds are only guaranteed fresh for ~120s on-chain; re-read on the
    // same order of magnitude so a long-open Send screen isn't quoting a
    // price from ten minutes ago.
    const timer = window.setInterval(() => {
      if (!cancelled) prime();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

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
