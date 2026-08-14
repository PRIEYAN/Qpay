import { useCallback } from 'react';
import { useQpayContext } from '../context/QpayProvider';
import { Profile, PrimaryAsset } from '../services/types';
import { updateProfile as updateProfileService, setPrimaryAsset as setPrimaryAssetService } from '../services/qpayService';

export type UseProfileResult = {
  data: Profile | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  /** Seam: QpayLedger.setPrimaryAsset. */
  updateProfile: (patch: Partial<Profile>) => Promise<Profile>;
  setPrimaryAsset: (asset: PrimaryAsset) => Promise<void>;
};

/** The current user's profile — identity, primary asset, wallet/XRPL addresses, onboarding state. */
export function useProfile(): UseProfileResult {
  const { snapshot, loading, error, refresh } = useQpayContext();

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const result = await updateProfileService(patch);
      await refresh();
      return result;
    },
    [refresh],
  );

  const setPrimaryAsset = useCallback(
    async (asset: PrimaryAsset) => {
      await setPrimaryAssetService(asset);
      await refresh();
    },
    [refresh],
  );

  return {
    data: snapshot?.profile ?? null,
    loading,
    error,
    refresh,
    updateProfile,
    setPrimaryAsset,
  };
}
