import { useCallback, useState } from 'react';
import { useQpayContext } from '../context/QpayProvider';
import {
  CreatePaymentRequestInput,
  PaymentRequest,
  PayOptions,
  RedeemOptions,
  Transaction,
} from '../services/types';
import {
  cancelPaymentRequest as cancelPaymentRequestService,
  depositFxrp as depositFxrpService,
  markPaymentRequestPaid as markPaymentRequestPaidService,
  pay as payService,
  redeemFxrp as redeemFxrpService,
  requestMoney as requestMoneyService,
} from '../services/qpayService';

export type UsePayResult = {
  /** The most recent mutation's result (a Transaction), or null before any call this session. */
  data: Transaction | null;
  /** True while a mutation is in flight. */
  loading: boolean;
  error: Error | null;
  /** Re-syncs the shared snapshot (mutations already do this automatically). */
  refresh: () => Promise<void>;

  /** Seam: QpayLedger.pay / payWithAuth. Throws InsufficientBalanceError / InvalidAmountError. */
  pay: (to: string, amount: number, ref: string, opts?: PayOptions) => Promise<Transaction>;
  /** Seam: QpayGateway.withdrawToXRPL. Throws BelowLotSizeError / InsufficientBalanceError. */
  redeemFxrp: (amount: number, xrplAddress: string, opts?: RedeemOptions) => Promise<Transaction>;
  /** Seam: ERC20.approve + QpayLedger.deposit — wallet FXRP into the spendable ledger balance. Throws InsufficientBalanceError. */
  depositFxrp: (amount: number) => Promise<Transaction>;
  requestMoney: (input?: CreatePaymentRequestInput) => Promise<PaymentRequest>;
  markPaymentRequestPaid: (
    id: string,
    opts?: { fromQpayId?: string },
  ) => Promise<{ request: PaymentRequest; transaction: Transaction }>;
  cancelPaymentRequest: (id: string) => Promise<PaymentRequest>;
};

/**
 * All the mutating operations in one hook, each wrapped so the shared
 * QpayProvider snapshot is refreshed as soon as the mutation settles (on top
 * of the automatic refresh qpayService's subscribe/notify already triggers —
 * belt and braces so callers can `await` and immediately trust `data`).
 */
export function usePay(): UsePayResult {
  const { refresh } = useQpayContext();
  const [data, setData] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Shared mutation envelope: flips loading/error around the call, lets the
   * caller record the result, then re-syncs the shared snapshot.
   *
   * This takes an already-bound thunk rather than a function-plus-args so it
   * can itself be a stable `useCallback` — building the wrapped function
   * during render (as an inline `wrap(fn)` would) hands `useCallback` a fresh
   * closure every time, which defeats the memoization it looks like it has.
   */
  const runMutation = useCallback(
    async <R,>(fn: () => Promise<R>, onResult?: (r: R) => void): Promise<R> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn();
        onResult?.(result);
        await refresh();
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  const pay = useCallback<UsePayResult['pay']>(
    (to, amount, ref, opts) => runMutation(() => payService(to, amount, ref, opts), setData),
    [runMutation],
  );

  const redeemFxrp = useCallback<UsePayResult['redeemFxrp']>(
    (amount, xrplAddress, opts) =>
      runMutation(() => redeemFxrpService(amount, xrplAddress, opts), setData),
    [runMutation],
  );

  const depositFxrp = useCallback<UsePayResult['depositFxrp']>(
    (amount) => runMutation(() => depositFxrpService(amount), setData),
    [runMutation],
  );

  const requestMoney = useCallback<UsePayResult['requestMoney']>(
    (input) => runMutation(() => requestMoneyService(input)),
    [runMutation],
  );

  const markPaymentRequestPaid = useCallback<UsePayResult['markPaymentRequestPaid']>(
    (id, opts) =>
      runMutation(
        () => markPaymentRequestPaidService(id, opts),
        (r) => setData(r.transaction),
      ),
    [runMutation],
  );

  const cancelPaymentRequest = useCallback<UsePayResult['cancelPaymentRequest']>(
    (id) => runMutation(() => cancelPaymentRequestService(id)),
    [runMutation],
  );

  return {
    data,
    loading,
    error,
    refresh,
    pay,
    redeemFxrp,
    depositFxrp,
    requestMoney,
    markPaymentRequestPaid,
    cancelPaymentRequest,
  };
}
