import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AmountDisplay,
  Button,
  Card,
  Divider,
  Icon,
  Input,
  Notice,
  Row,
  Screen,
  StatusTag,
} from '../components/ui';
import { FadeIn, PopIn, haptic } from '../components/motion';
import { useQpayContext } from '../context/QpayProvider';
import { useBalances, usePay } from '../hooks';
import {
  InsufficientBalanceError,
  getWalletFxrpBalance,
  type Transaction,
} from '../services/qpayService';
import { ConnectionGate } from './components/ConnectionGate';

/**
 * Wallet FXRP -> spendable Qpay balance (QpayLedger.deposit).
 *
 * The ingress counterpart to Redeem. Two balances matter here and they are
 * deliberately shown side by side, because conflating them is the single
 * most confusing thing about a custodial-ledger app: FXRP sitting in your
 * wallet cannot be paid with, and FXRP in the ledger cannot be sent outside
 * Qpay without redeeming.
 */
export default function DepositScreen() {
  const navigate = useNavigate();
  const { error: qpayError } = useQpayContext();
  const { data: balances } = useBalances();
  const { depositFxrp, loading } = usePay();

  const [amount, setAmount] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Transaction | null>(null);

  const ledgerBalance = balances?.FXRP ?? null;
  const amountValue = Number(amount) || 0;
  const overWallet = walletBalance != null && amountValue > walletBalance;
  const canSubmit = amountValue > 0 && !overWallet && !loading;

  const refreshWallet = useCallback(async () => {
    try {
      setWalletBalance(await getWalletFxrpBalance());
    } catch {
      // Not connected / not configured — ConnectionGate already explains why;
      // leaving this null renders "—" rather than a fabricated zero.
      setWalletBalance(null);
    }
  }, []);

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet, result]);

  const submit = async () => {
    setError(null);
    haptic('tap');
    try {
      const tx = await depositFxrp(amountValue);
      haptic('success');
      setResult(tx);
    } catch (e) {
      haptic('warning');
      if (e instanceof InsufficientBalanceError) {
        setError(`Not enough FXRP in your wallet: need ${e.requested}, have ${e.available}.`);
      } else {
        setError(e instanceof Error ? e.message : 'Deposit failed.');
      }
    }
  };

  const useMax = () => {
    if (walletBalance == null) return;
    haptic('select');
    setAmount(String(walletBalance));
    setError(null);
  };

  if (result) {
    return (
      <Screen title="Deposited" footer={<Button label="Done" onClick={() => navigate(-1)} />}>
        <div className="center stack stack--md" style={{ paddingBlock: 'var(--space-lg)' }}>
          <PopIn>
            <span className="send__success-badge">
              <Icon name="check" size={36} />
            </span>
          </PopIn>
          <AmountDisplay
            value={result.amount}
            asset="FXRP"
            size="display"
            caption="Now spendable in Qpay"
          />
          <StatusTag label="Confirmed on Coston2" emphasis="solid" />
        </div>

        <FadeIn delay={120}>
          <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
            <Row label="Deposited" value={`${result.amount.toFixed(2)} FXRP`} />
            <Divider />
            <Row label="Spendable balance" value={`${(ledgerBalance ?? 0).toFixed(2)} FXRP`} />
          </Card>
        </FadeIn>
      </Screen>
    );
  }

  return (
    <Screen
      title="Deposit FXRP"
      onBack={() => navigate(-1)}
      footer={
        <>
          {error ? <Notice message={error} tone="danger" /> : null}
          <Button
            label={loading ? 'Depositing…' : 'Deposit'}
            onClick={() => void submit()}
            disabled={!canSubmit}
            loading={loading}
          />
        </>
      }
    >
      <ConnectionGate error={qpayError}>
        <div className="stack stack--lg">
          <p className="t-body c-muted">
            Move FXRP from your wallet into Qpay so you can spend it. Depositing approves the ledger
            once, then transfers — two wallet prompts the first time.
          </p>

          <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
            <Row
              label="In your wallet"
              value={walletBalance == null ? '—' : `${walletBalance.toFixed(2)} FXRP`}
            />
            <Divider />
            <Row
              label="Spendable in Qpay"
              value={ledgerBalance == null ? '—' : `${ledgerBalance.toFixed(2)} FXRP`}
            />
          </Card>

          <div className="stack stack--sm">
            <Input
              label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              type="number"
              min={0}
              step="any"
              suffix="FXRP"
              amount
            />
            <button
              type="button"
              className="t-label c-accent"
              style={{ alignSelf: 'flex-end', fontWeight: 700 }}
              onClick={useMax}
              disabled={walletBalance == null}
            >
              Use max
            </button>
          </div>

          {overWallet ? (
            <Notice
              message={`That's more than your wallet holds (${(walletBalance ?? 0).toFixed(2)} FXRP).`}
              tone="danger"
            />
          ) : null}
        </div>
      </ConnectionGate>
    </Screen>
  );
}
