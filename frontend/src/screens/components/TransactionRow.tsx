import { Icon, StatusTag } from '../../components/ui';
import { formatRelativeTime } from '../../utils';
import type { Transaction, TransactionDirection } from '../../services/qpayService';

const OUTGOING_DIRECTIONS = new Set<TransactionDirection>(['sent', 'egress']);

export function directionLabel(direction: TransactionDirection): string {
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

/**
 * Transaction row with a leading directional icon (arrowUpRight for money
 * out, arrowDownLeft for money in) and the amount tinted success/danger —
 * the one place in the app colour is allowed to carry money direction.
 * Everything else follows the shared row's ink/paper press inversion so it
 * sits naturally next to the other list rows.
 */
export function TransactionRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) {
  const outgoing = OUTGOING_DIRECTIONS.has(tx.direction);

  return (
    <button type="button" className="row" onClick={onClick}>
      <span className={`row__badge ${outgoing ? 'c-danger' : 'c-success'}`}>
        <Icon name={outgoing ? 'arrowUpRight' : 'arrowDownLeft'} size={16} />
      </span>

      <span className="row__text">
        <span className="t-body-medium truncate">{tx.counterparty}</span>
        <span className="t-label c-muted truncate">
          {directionLabel(tx.direction)} · {formatRelativeTime(tx.timestamp)}
        </span>
        {tx.status !== 'confirmed' ? (
          <span style={{ marginTop: 4 }}>
            <StatusTag
              label={tx.status}
              tone={tx.status === 'failed' ? 'danger' : 'neutral'}
            />
          </span>
        ) : null}
      </span>

      <span className="row__value">
        <span className={`t-body-medium ${outgoing ? 'c-danger' : 'c-success'}`}>
          {outgoing ? '−' : '+'}
          {tx.amount.toFixed(2)}
        </span>
        <span className="t-micro c-muted">{tx.asset}</span>
      </span>
    </button>
  );
}
