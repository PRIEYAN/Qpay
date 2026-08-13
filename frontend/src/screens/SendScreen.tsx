import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AmountDisplay,
  Avatar,
  Button,
  Card,
  Icon,
  Input,
  KeypadNumeric,
  Notice,
  Row,
  Screen,
} from '../components/ui';
import { FadeIn, PopIn, SlideIn, haptic } from '../components/motion';
import { useQpayContext } from '../context/QpayProvider';
import { useBalances, usePay } from '../hooks';
import {
  InsufficientBalanceError,
  InvalidAmountError,
  quoteConversion,
  type PrimaryAsset,
} from '../services/qpayService';
import { formatAmount } from '../utils';
import { ConnectionGate } from './components/ConnectionGate';

type Step = 'amount' | 'confirm' | 'success';

/**
 * Google Pay style single-screen flow: amount (big keypad-driven readout) ->
 * confirm (You send / They receive / fee / settlement) -> success.
 *
 * Arrives pre-addressed via query params (`?to=<qpayId>&name=<label>`), set
 * by ContactPicker, a QR scan or a dashboard contact chip. With no
 * recipient it hands off to ContactPicker rather than rendering a dead form.
 */
export default function SendScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { snapshot, error: qpayError } = useQpayContext();
  const { primaryAsset, primaryBalance } = useBalances();
  const { pay } = usePay();

  const paramQpayId = params.get('to') ?? '';
  const paramName = params.get('name') ?? '';
  const paramAmount = params.get('amount');
  const paramNote = params.get('note') ?? '';
  const hasRecipient = !!(paramQpayId || paramName);

  const [step, setStep] = useState<Step>('amount');
  const [amountStr, setAmountStr] = useState(paramAmount ?? '');
  const [note, setNote] = useState(paramNote);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  const contactMatch = useMemo(
    () =>
      snapshot?.contacts.find(
        (c) => (paramQpayId && c.qpayId === paramQpayId) || (paramName && c.name === paramName),
      ) ?? null,
    [snapshot, paramQpayId, paramName],
  );
  const businessMatch = useMemo(
    () =>
      !contactMatch
        ? (snapshot?.businesses.find(
            (b) => (paramQpayId && b.qpayId === paramQpayId) || (paramName && b.name === paramName),
          ) ?? null)
        : null,
    [snapshot, contactMatch, paramQpayId, paramName],
  );

  const recipientName = contactMatch?.name ?? businessMatch?.name ?? paramName ?? paramQpayId;
  const recipientQpayId = contactMatch?.qpayId ?? businessMatch?.qpayId ?? paramQpayId;
  const recipientTo = recipientQpayId || recipientName;

  const senderAsset: PrimaryAsset = primaryAsset ?? 'FXRP';
  const recipientAsset: PrimaryAsset =
    contactMatch?.primaryAsset ?? businessMatch?.primaryAsset ?? senderAsset;

  const amountValue = amountStr ? Number(amountStr) : 0;
  const exceedsBalance = primaryBalance != null && amountValue > primaryBalance;
  const canContinue = hasRecipient && amountValue > 0 && !exceedsBalance;

  const quote = useMemo(
    () => quoteConversion(amountValue, senderAsset, recipientAsset),
    [amountValue, senderAsset, recipientAsset],
  );

  async function handleConfirm() {
    setError(null);
    setPaying(true);
    haptic('tap');
    try {
      const tx = await pay(
        recipientTo,
        amountValue,
        `send-${Date.now()}`,
        note.trim() ? { note: note.trim() } : undefined,
      );
      setTxId(tx.id);
      haptic('success');
      setStep('success');
    } catch (e) {
      haptic('warning');
      if (e instanceof InsufficientBalanceError) {
        setError(`Not enough ${e.asset}. You have ${formatAmount(e.available, e.asset)}.`);
      } else if (e instanceof InvalidAmountError) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setPaying(false);
    }
  }

  if (!hasRecipient) {
    return (
      <Screen title="Send" onBack={() => navigate(-1)}>
        <div className="stack stack--md">
          <Notice message="Choose who you're paying first." />
          <Button label="Choose a contact" onClick={() => navigate('/app/contacts?mode=send')} />
        </div>
      </Screen>
    );
  }

  if (step === 'success') {
    return (
      <Screen
        footer={
          <>
            <Button label="Done" onClick={() => navigate('/app', { replace: true })} />
            <Button
              label="View details"
              variant="ghost"
              onClick={() => txId && navigate(`/app/tx/${encodeURIComponent(txId)}`, { replace: true })}
              disabled={!txId}
            />
          </>
        }
      >
        <div className="center stack stack--lg" style={{ paddingTop: 'var(--space-xxl)' }}>
          <PopIn>
            <span className="send__success-badge">
              <Icon name="check" size={40} />
            </span>
          </PopIn>
          <FadeIn delay={220}>
            <div className="center">
              <AmountDisplay
                value={amountValue}
                asset={senderAsset}
                caption={`to ${recipientName}`}
                size="display"
              />
            </div>
          </FadeIn>
        </div>
      </Screen>
    );
  }

  if (step === 'confirm') {
    return (
      <Screen
        title="Confirm"
        onBack={() => setStep('amount')}
        footer={
          <>
            {error ? <Notice message={error} tone="danger" /> : null}
            <Button label="Confirm & pay" onClick={() => void handleConfirm()} loading={paying} />
          </>
        }
      >
        <RecipientHeader name={recipientName} qpayId={recipientQpayId} />

        {/* A slightly slower, deliberate entrance — this is the moment real money moves. */}
        <SlideIn duration={320} distance={20}>
          <Card>
            <Row label="You send" value={formatAmount(amountValue, senderAsset)} />
            <Row
              label="They receive"
              // A stale quote means the oracle price hasn't been read yet —
              // showing the resulting 0.00 as if it were the real converted
              // amount would be a lie about how much the recipient gets.
              value={
                quote.stale ? 'Rate unavailable' : formatAmount(quote.amountOut, recipientAsset)
              }
            />
            {quote.isCrossAsset && !quote.stale ? (
              <p className="t-micro c-muted" style={{ padding: '0 var(--space-sm) var(--space-sm)' }}>
                1 {senderAsset} ≈ {quote.rate.toFixed(4)} {recipientAsset} · incl.{' '}
                {(quote.spreadBps / 100).toFixed(2)}% swap spread
              </p>
            ) : null}
            {quote.stale ? (
              <p className="t-micro c-muted" style={{ padding: '0 var(--space-sm) var(--space-sm)' }}>
                Live {senderAsset}/{recipientAsset} price couldn't be read. The payment still
                settles at the on-chain rate at the moment it executes.
              </p>
            ) : null}
            <Row label="Network fee" value="Sponsored — no gas" />
            <Row label="Settles in" value="~1.8s" />
            {note.trim() ? <Row label="Note" value={note.trim()} /> : null}
          </Card>
        </SlideIn>
      </Screen>
    );
  }

  return (
    <Screen
      title="Send"
      onBack={() => navigate(-1)}
      footer={
        <Button label="Continue" onClick={() => setStep('confirm')} disabled={!canContinue} />
      }
    >
      <ConnectionGate error={qpayError}>
        <RecipientHeader name={recipientName} qpayId={recipientQpayId} />

        <div className="center" style={{ paddingBlock: 'var(--space-lg)' }}>
          <AmountDisplay value={amountValue} asset={senderAsset} size="display" />
        </div>

        {exceedsBalance ? (
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <Notice
              message={`Exceeds your balance of ${formatAmount(primaryBalance ?? 0, senderAsset)}`}
              tone="danger"
            />
          </div>
        ) : null}

        <Input
          label="Add a note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's it for?"
          containerClassName="send__note"
        />

        <KeypadNumeric value={amountStr} onChange={setAmountStr} />
      </ConnectionGate>
    </Screen>
  );
}

export function RecipientHeader({ name, qpayId }: { name: string; qpayId: string }) {
  return (
    <div className="cluster" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
      <Avatar name={name} size={44} />
      <div className="row__text">
        <span className="t-body-medium truncate">{name}</span>
        {qpayId ? <span className="t-label c-muted truncate">{qpayId}</span> : null}
      </div>
    </div>
  );
}
