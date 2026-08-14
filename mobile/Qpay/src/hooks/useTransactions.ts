import { useMemo } from 'react';
import { useQpayContext } from '../context/QpayProvider';
import { Transaction, TransactionFilter } from '../services/types';
import { filterTransactions } from '../services/qpayService';

export type UseTransactionsResult = {
  /** All transactions matching `filter`, newest first (already the storage order). */
  data: Transaction[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

/**
 * Transaction history, optionally filtered by direction/status/asset and a
 * free-text query over counterparty+note+ref (docs task §"Transactions").
 * Filtering happens in-memory against the already-loaded snapshot, so it's
 * synchronous from the caller's perspective — no extra round trip per keystroke.
 */
export function useTransactions(filter?: TransactionFilter): UseTransactionsResult {
  const { snapshot, loading, error, refresh } = useQpayContext();

  const data = useMemo(() => {
    if (!snapshot) return [];
    return filter ? filterTransactions(snapshot.transactions, filter) : snapshot.transactions;
  }, [snapshot, filter]);

  return { data, loading, error, refresh };
}
