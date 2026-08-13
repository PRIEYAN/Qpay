import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Divider,
  EmptyState,
  Screen,
  SearchBar,
  SegmentedControl,
  Skeleton,
} from '../../components/ui';
import { useQpayContext } from '../../context/QpayProvider';
import { useTransactions } from '../../hooks';
import type { TransactionDirection, TransactionFilter } from '../../services/types';
import { ConnectionGate } from '../components/ConnectionGate';
import { TransactionRow } from '../components/TransactionRow';

type Tab = 'all' | 'sent' | 'received';

const TABS: { label: string; value: Tab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Sent', value: 'sent' },
  { label: 'Received', value: 'received' },
];

/**
 * Full transaction history with a free-text search over counterparty, note
 * and ref, plus a direction filter. Filtering runs in-memory against the
 * already-loaded snapshot (see `useTransactions`), so it stays synchronous
 * per keystroke instead of a round trip.
 */
export default function LogsScreen() {
  const navigate = useNavigate();
  const { loading, error } = useQpayContext();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');

  const filter = useMemo<TransactionFilter>(() => {
    const next: TransactionFilter = {};
    if (tab !== 'all') next.direction = tab as TransactionDirection;
    if (query.trim()) next.query = query.trim();
    return next;
  }, [tab, query]);

  const { data } = useTransactions(filter);

  return (
    <Screen title="Activity">
      <div className="stack stack--md">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search by name, note or reference"
        />

        <SegmentedControl options={TABS} value={tab} onChange={setTab} />

        <ConnectionGate error={error}>
          {loading ? (
            <div className="stack stack--sm">
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              icon="activity"
              title={query || tab !== 'all' ? 'Nothing matches' : 'No activity yet'}
              body={
                query || tab !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Payments you send or receive will show up here.'
              }
            />
          ) : (
            <Card padded={false} variant="flat" style={{ paddingInline: 'var(--space-md)' }}>
              {data.map((tx, i) => (
                <div key={tx.id}>
                  <TransactionRow
                    tx={tx}
                    onClick={() => navigate(`/app/tx/${encodeURIComponent(tx.id)}`)}
                  />
                  {i < data.length - 1 ? <Divider /> : null}
                </div>
              ))}
            </Card>
          )}
        </ConnectionGate>
      </div>
    </Screen>
  );
}
