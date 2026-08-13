import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AmountDisplay,
  Avatar,
  Card,
  Divider,
  EmptyState,
  Icon,
  Row,
  Screen,
  SectionLabel,
  StatusTag,
  Toast,
  useCopy,
} from '../components/ui';
import { FadeIn, SlideIn } from '../components/motion';
import { useTransactions } from '../hooks';
import { COSTON2 } from '../config/network';
import { formatAmount, truncateAddress } from '../utils';
import type { TransactionDirection } from '../services/types';
import { ConnectionGate } from './components/ConnectionGate';
import './txDetail.css';

const OUTGOING = new Set<TransactionDirection>(['sent', 'egress']);

function directionLabel(direction: TransactionDirection): string {
  switch (direction) {
    case 'sent':
      return 'Sent';
    case 'received':
      return 'Received';
    case 'ingress':
      return 'Deposit';
    case 'egress':
      return 'Withdrawal';
    default:
      return direction;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'pending':
      return 'Pending';
    case 'partial':
      return 'Partial fill';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

/**
 * The receipts screen: every row that can prove itself against the ledger
 * does, right down to the tx hash and explorer link. Reads from the
 * already-loaded snapshot via `useTransactions` rather than a fetch-by-id
 * call (the service layer has none).
 */
export default function TransactionDetailScreen() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { data: transactions, error } = useTransactions();
  const [copied, copy] = useCopy();

  const tx = useMemo(() => transactions.find((t) => t.id === id), [transactions, id]);

  if (!tx) {
    return (
      <Screen title="Receipt" onBack={() => navigate(-1)}>
        <ConnectionGate error={error}>
          <EmptyState
            icon="receipt"
            title="Not found"
            body="This transaction is no longer available in your history."
          />
        </ConnectionGate>
      </Screen>
    );
  }

  const outgoing = OUTGOING.has(tx.direction);
  const signedValue = outgoing ? -tx.amount : tx.amount;
  const isEgress = tx.direction === 'egress';
  const isCrossAsset = !!tx.assetOut;

  // Egress refs encode lot-fill honesty as `redeem-<filled>of<requested>lots`
  // (partial) or `redeem-<filled>lots` (full) — see qpayService.redeemFxrp.
  const lotMatch = isEgress ? tx.ref.match(/^redeem-(\d+)(?:of(\d+))?lots$/) : null;
  const filledLots = lotMatch ? Number(lotMatch[1]) : null;
  const requestedLots = lotMatch && lotMatch[2] ? Number(lotMatch[2]) : filledLots;

  const explorerUrl = tx.blockExplorerUrl || `${COSTON2.explorerUrl}/tx/${tx.txHash}`;

  return (
    <Screen title="Receipt" onBack={() => navigate(-1)}>
      <div className="stack stack--lg">
        <SlideIn distance={12}>
          <div className="center stack stack--md">
            <span className={`tx__badge ${outgoing ? 'c-danger' : 'c-success'}`}>
              <Icon name={outgoing ? 'arrowUpRight' : 'arrowDownLeft'} size={20} />
            </span>
            <AmountDisplay
              value={signedValue}
              asset={tx.asset}
              size="display"
              caption={`${directionLabel(tx.direction)} · ${statusLabel(tx.status)}`}
            />
          </div>

          <div className="tx__counterparty">
            <Avatar name={tx.counterparty} size={48} />
            <div className="stack stack--xs grow">
              <span className="t-caption c-muted">{outgoing ? 'To' : 'From'}</span>
              <span className="t-body-medium truncate">{tx.counterparty}</span>
            </div>
            {tx.status !== 'confirmed' ? (
              <StatusTag
                label={statusLabel(tx.status)}
                tone={tx.status === 'failed' ? 'danger' : 'neutral'}
              />
            ) : null}
          </div>
        </SlideIn>

        {isCrossAsset ? (
          <FadeIn delay={60}>
            <section>
              <SectionLabel>Conversion</SectionLabel>
              <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
                <Row label="You sent" value={formatAmount(tx.amount, tx.asset)} />
                <Divider />
                <Row
                  label="They received"
                  value={formatAmount(tx.amountOut ?? 0, tx.assetOut ?? '')}
                />
              </Card>
            </section>
          </FadeIn>
        ) : null}

        {isEgress && filledLots != null ? (
          <FadeIn delay={80}>
            <section>
              <SectionLabel>Redemption</SectionLabel>
              <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
                <Row
                  label="Lots filled"
                  value={
                    requestedLots != null && requestedLots !== filledLots
                      ? `${filledLots} of ${requestedLots}`
                      : String(filledLots)
                  }
                />
                <Divider />
                <Row label="Sent to XRPL" value={formatAmount(tx.amount, 'XRP')} />
              </Card>
            </section>
          </FadeIn>
        ) : null}

        <FadeIn delay={100}>
          <section>
            <SectionLabel>Details</SectionLabel>
            <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
              <Row label="Date" value={new Date(tx.timestamp).toLocaleString()} />
              <Divider />
              <Row label="Status" value={statusLabel(tx.status)} />
              {tx.note ? (
                <>
                  <Divider />
                  <Row label="Note" value={tx.note} />
                </>
              ) : null}
              {tx.ref ? (
                <>
                  <Divider />
                  <Row label="Reference" value={tx.ref} />
                </>
              ) : null}
              {tx.counterpartyAddress ? (
                <>
                  <Divider />
                  <Row
                    label={outgoing ? 'To address' : 'From address'}
                    value={truncateAddress(tx.counterpartyAddress)}
                    onClick={() => copy(tx.counterpartyAddress as string)}
                  />
                </>
              ) : null}
              {tx.blockNumber ? (
                <>
                  <Divider />
                  <Row label="Block" value={String(tx.blockNumber)} />
                </>
              ) : null}
            </Card>
          </section>
        </FadeIn>

        <FadeIn delay={120}>
          <section>
            <SectionLabel>On chain</SectionLabel>
            <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
              <Row
                label="Transaction hash"
                value={truncateAddress(tx.txHash, { prefix: 10, suffix: 8 })}
                icon="copy"
                onClick={() => copy(tx.txHash)}
              />
              <Divider />
              <a className="row" href={explorerUrl} target="_blank" rel="noreferrer noopener">
                <Icon name="externalLink" size={18} className="c-muted" />
                <span className="t-body grow">View on Coston2 explorer</span>
                <Icon name="chevronRight" size={18} className="c-muted" />
              </a>
            </Card>
          </section>
        </FadeIn>

        <Toast message="Copied" visible={copied} />
      </div>
    </Screen>
  );
}
