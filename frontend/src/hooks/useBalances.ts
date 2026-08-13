import { useMemo } from 'react';
import { useQpayContext } from '../context/QpayProvider';
import { Balances, ChainBalance, PrimaryAsset } from '../services/types';
import { chainBalancesFrom } from '../services/qpayService';

export type UseBalancesResult = {
  /** Per-asset balances, keyed by PrimaryAsset. Null until the first load resolves. */
  data: Balances | null;
  /** Same data, shaped for the Chains screen (label + egress copy per asset). */
  chainBalances: ChainBalance[];
  /** The current user's primary asset and its balance, for the dashboard's single big number. */
  primaryAsset: PrimaryAsset | null;
  primaryBalance: number | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

/** Seam: QpayLedger.balances(user, asset). Reactive — updates the instant any pay()/redeemFxrp() call settles anywhere in the app. */
export function useBalances(): UseBalancesResult {
  const { snapshot, loading, error, refresh } = useQpayContext();

  const chainBalances = useMemo(
    () => (snapshot ? chainBalancesFrom(snapshot.balances) : []),
    [snapshot],
  );

  return {
    data: snapshot?.balances ?? null,
    chainBalances,
    primaryAsset: snapshot?.profile.primaryAsset ?? null,
    primaryBalance: snapshot ? snapshot.balances[snapshot.profile.primaryAsset] : null,
    loading,
    error,
    refresh,
  };
}
