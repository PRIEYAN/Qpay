import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AmountDisplay,
  Button,
  Card,
  Divider,
  Input,
  Notice,
  Row,
  Screen,
  Skeleton,
  StatusTag,
} from '../components/ui';
import { FadeIn, haptic } from '../components/motion';
import { useQpayContext } from '../context/QpayProvider';
import { useBalances, usePay } from '../hooks';
import {
  BelowLotSizeError,
  InsufficientBalanceError,
  getFxrpLotSize,
  type Transaction,
} from '../services/qpayService';
import { computeLotBreakdown } from '../contracts';
import { ConnectionGate } from './components/ConnectionGate';
import './redeem.css';

/**
 * FXRP → real XRP via FAssets redemption. Lot-granular and partial-fill
 * aware: every number shown is derived from the same lot math the service
 * enforces, never a rounded-up promise.
 *
 * The lot size is read live from the AssetManager rather than hardcoded —
 * Coston2's 10 FXRP/lot is not guaranteed to match mainnet or to stay
 * constant, and a stale constant here would mean showing the user a
 * breakdown the chain then rejects.
 */
export default function RedeemScreen() {
  const navigate = useNavigate();
  const { error: qpayError } = useQpayContext();
  const { data: balances } = useBalances();
  const { redeemFxrp, loading } = usePay();

  const [amount, setAmount] = useState('');
  const [xrplAddress, setXrplAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lotSize, setLotSize] = useState<number | null>(null);
  const [lotError, setLotError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    tx: Transaction;
    requestedLots: number;
    remainder: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    getFxrpLotSize()
      .then((size) => {
        if (active) setLotSize(size);
      })
      .catch((e: unknown) => {
        if (active) {
          setLotError(e instanceof Error ? e.message : 'Could not read the current lot size.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const fxrpBalance = balances?.FXRP ?? null;
  const amountValue = Number(amount) || 0;

  // Until the live lot size lands, no lot math is shown at all rather than
  // guessing at a boundary the chain may not agree with.
  const breakdown =
    lotSize != null && amountValue > 0
      ? computeLotBreakdown(amountValue, lotSize)
      : { lots: 0, exact: 0, remainder: 0 };

  const belowLot = lotSize != null && amountValue > 0 && breakdown.lots < 1;
  const overBalance = fxrpBalance != null && breakdown.exact > fxrpBalance;
  const canSubmit =
    lotSize != null && breakdown.lots >= 1 && !!xrplAddress.trim() && !overBalance && !loading;

  const submit = async () => {
    setError(null);
    haptic('tap');
    try {
      const tx = await redeemFxrp(amountValue, xrplAddress.trim());
      haptic('success');
      setResult({ tx, requestedLots: breakdown.lots, remainder: breakdown.remainder });
    } catch (e) {
      haptic('warning');
      if (e instanceof BelowLotSizeError) {
        setError(`Redemption works in whole ${e.lotSize}-XRP lots. ${e.amount} is below that.`);
      } else if (e instanceof InsufficientBalanceError) {
        setError(`Not enough FXRP: requested ${e.requested}, available ${e.available}.`);
      } else {
        setError(e instanceof Error ? e.message : 'Redemption failed.');
      }
    }
  };

  if (result) {
    const { tx, requestedLots, remainder: preRemainder } = result;
    const filledLots = lotSize ? tx.amount / lotSize : 0;
    const isPartial = tx.status === 'partial';
    const fillRatio = requestedLots > 0 ? filledLots / requestedLots : 1;

    return (
      <Screen title="Redeemed" footer={<Button label="Done" onClick={() => navigate(-1)} />}>
        <div className="center stack stack--md" style={{ paddingBlock: 'var(--space-lg)' }}>
          <AmountDisplay
            value={tx.amount}
            asset="XRP"
            size="display"
            caption={isPartial ? 'Partially filled — sent to XRPL' : 'Sent to XRPL'}
          />
          {isPartial ? <StatusTag label="Partial fill" emphasis="solid" /> : null}
        </div>

        <FadeIn delay={120}>
          <Card className="redeem__ring-card">
            <ProgressRing progress={fillRatio} />
            <div className="stack stack--xs grow">
              <span className="t-body-medium">
                {filledLots} of {requestedLots} lots filled
              </span>
              <span className="t-label c-muted">
                {Math.round(fillRatio * 100)}% of this redemption request
              </span>
            </div>
          </Card>
        </FadeIn>

        <Card padded={false} style={{ marginTop: 'var(--space-md)', paddingInline: 'var(--space-md)' }}>
          <Row label="Lots filled" value={`${filledLots} of ${requestedLots}`} />
          <Divider />
          <Row label="Sent to XRPL" value={`${tx.amount.toFixed(2)} XRP`} />
          {preRemainder > 0 ? (
            <>
              <Divider />
              <Row label="Left spendable" value={`${preRemainder.toFixed(2)} FXRP`} />
            </>
          ) : null}
          <Divider />
          <Row label="Destination" value={xrplAddress.trim()} />
        </Card>

        {isPartial ? (
          <p className="t-label c-muted" style={{ marginTop: 'var(--space-md)' }}>
            Only part of your request could be filled — redemption agents ran out of tickets. The
            unfilled amount was never debited and is still spendable.
          </p>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      title="Redeem to XRP"
      onBack={() => navigate(-1)}
      footer={
        <>
          {error ? <Notice message={error} tone="danger" /> : null}
          <Button
            label={loading ? 'Redeeming…' : 'Redeem'}
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
            Convert FXRP back into real XRP on the XRP Ledger. This is the one slow step in Qpay —
            it settles in minutes, not seconds.
          </p>

          {lotError ? <Notice message={lotError} tone="danger" /> : null}

          <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
            <Row
              label="Spendable FXRP"
              value={fxrpBalance == null ? '—' : `${fxrpBalance.toFixed(2)} FXRP`}
            />
            <Divider />
            <Row
              label="Lot size"
              value={lotSize == null ? '—' : `${lotSize} FXRP`}
            />
          </Card>

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

          {lotSize == null && !lotError ? (
            <Skeleton height={72} />
          ) : amountValue > 0 ? (
            <Card variant="flat">
              {belowLot ? (
                <p className="t-label c-muted">
                  Redemption happens in whole {lotSize}-FXRP lots. Enter at least {lotSize} FXRP.
                </p>
              ) : (
                <div className="stack stack--xs">
                  <div className="spread">
                    <span className="t-label c-muted">Redeeming</span>
                    <span className="t-body-medium">
                      {breakdown.lots} lot{breakdown.lots === 1 ? '' : 's'} ·{' '}
                      {breakdown.exact.toFixed(2)} FXRP
                    </span>
                  </div>
                  {breakdown.remainder > 0 ? (
                    <div className="spread">
                      <span className="t-label c-muted">Stays spendable</span>
                      <span className="t-body-medium">{breakdown.remainder.toFixed(2)} FXRP</span>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>
          ) : null}

          {overBalance ? (
            <Notice
              message={`That's more than your spendable balance (${(fxrpBalance ?? 0).toFixed(2)} FXRP).`}
              tone="danger"
            />
          ) : null}

          <Input
            label="XRP Ledger address"
            value={xrplAddress}
            onChange={(e) => setXrplAddress(e.target.value)}
            placeholder="r…"
            spellCheck={false}
            autoComplete="off"
          />

          <p className="t-micro c-muted">
            Double-check this address. XRP sent to the wrong address cannot be recovered.
          </p>
        </div>
      </ConnectionGate>
    </Screen>
  );
}

/** Circular fill indicator — the web port of mobile's `ProgressRing`. */
function ProgressRing({ progress, size = 64, strokeWidth = 6 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <svg width={size} height={size} className="redeem__ring" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset var(--duration-slower) var(--ease-standard)' }}
      />
    </svg>
  );
}
