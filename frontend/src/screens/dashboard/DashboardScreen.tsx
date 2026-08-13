import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionTile,
  AmountDisplay,
  Avatar,
  Card,
  ContactChip,
  Divider,
  EmptyState,
  Icon,
  Screen,
  SearchBar,
  SectionLabel,
  Skeleton,
} from '../../components/ui';
import { Stagger, haptic } from '../../components/motion';
import { useQpayContext } from '../../context/QpayProvider';
import type { Business, Contact, Transaction } from '../../services/qpayService';
import { ConnectionGate } from '../components/ConnectionGate';
import { TransactionRow } from '../components/TransactionRow';
import './dashboard.css';

/** Favourites first, then most-recently-paid first; never-paid contacts sink to the bottom. */
function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    if (a.favourite !== b.favourite) return a.favourite ? -1 : 1;
    return (b.lastPaidAt ?? 0) - (a.lastPaidAt ?? 0);
  });
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { snapshot, loading, error, refresh } = useQpayContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      haptic('select');
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const people = useMemo(() => sortContacts(snapshot?.contacts ?? []), [snapshot]);
  const businesses: Business[] = snapshot?.businesses ?? [];
  const recent: Transaction[] = (snapshot?.transactions ?? []).slice(0, 5);

  const balanceAmount = snapshot ? snapshot.balances[snapshot.profile.primaryAsset] : null;
  const balanceAsset = snapshot?.profile.primaryAsset ?? '';

  const openSend = (target: { name: string; qpayId: string }) =>
    navigate(`/app/send?to=${encodeURIComponent(target.qpayId)}&name=${encodeURIComponent(target.name)}`);

  return (
    <Screen>
      {/* Top bar — square avatar into Profile, wordmark, refresh + settings. */}
      <div className="dash__topbar">
        <button type="button" onClick={() => navigate('/app/profile')} aria-label="Profile">
          <Avatar
            name={snapshot?.profile.displayName ?? snapshot?.profile.username ?? ''}
            size={40}
          />
        </button>
        <span className="t-title">Qpay</span>
        <span className="cluster">
          <button
            type="button"
            onClick={() => void onRefresh()}
            aria-label="Refresh"
            disabled={refreshing}
          >
            <Icon name="refresh" size={20} className={refreshing ? 'm-spinner' : undefined} />
          </button>
          <button type="button" onClick={() => navigate('/app/settings')} aria-label="Settings">
            <Icon name="settings" size={22} />
          </button>
        </span>
      </div>

      <div className="dash__search">
        <SearchBar
          value=""
          readOnly
          placeholder="Pay anyone, any business"
          onClick={() => navigate('/app/contacts?mode=send')}
          onFocus={() => navigate('/app/contacts?mode=send')}
        />
      </div>

      <ConnectionGate error={error}>
        {/* Balance — the screen's subject. */}
        <Card variant="flat" className="dash__balance">
          {loading ? (
            <div className="center stack stack--sm">
              <Skeleton width={180} height={44} />
              <Skeleton width={120} height={14} />
            </div>
          ) : (
            <AmountDisplay
              value={balanceAmount}
              asset={balanceAsset}
              size="display"
              caption="Available to spend"
            />
          )}
          <button
            type="button"
            className="cluster dash__chains-link t-label c-muted"
            onClick={() => navigate('/app/chains')}
          >
            View chain balances
            <Icon name="chevronRight" size={16} />
          </button>
        </Card>

        {/* Primary actions. */}
        <div className="dash__actions">
          <ActionTile icon="scan" label="Scan" onClick={() => navigate('/app/scan')} />
          <ActionTile
            icon="send"
            label="Send"
            onClick={() => navigate('/app/contacts?mode=send')}
          />
          <ActionTile icon="request" label="Request" onClick={() => navigate('/app/request')} />
          <ActionTile
            icon="arrowDownLeft"
            label="Deposit"
            onClick={() => navigate('/app/deposit')}
          />
          <ActionTile icon="wallet" label="Redeem" onClick={() => navigate('/app/redeem')} />
        </div>

        {/* People. */}
        <section className="dash__section">
          <SectionLabel>People</SectionLabel>
          <div className="chip-row no-scrollbar">
            <button
              type="button"
              className="chip"
              onClick={() => navigate('/app/contacts?mode=send')}
              aria-label="New contact"
            >
              <span className="dash__new-avatar">
                <Icon name="plus" size={22} />
              </span>
              <span className="t-label">New</span>
            </button>

            <Stagger interval={35} direction="right" distance={10}>
              {people.map((contact) => (
                <ContactChip
                  key={contact.id}
                  name={contact.name}
                  subtitle={contact.favourite ? 'Favourite' : undefined}
                  onClick={() => openSend(contact)}
                />
              ))}
            </Stagger>
          </div>
        </section>

        {/* Businesses. */}
        {businesses.length > 0 ? (
          <section className="dash__section">
            <SectionLabel>Businesses</SectionLabel>
            <div className="chip-row no-scrollbar">
              <Stagger interval={35} direction="right" distance={10}>
                {businesses.map((business) => (
                  <ContactChip
                    key={business.id}
                    name={business.name}
                    subtitle={business.category}
                    onClick={() => openSend(business)}
                  />
                ))}
              </Stagger>
            </div>
          </section>
        ) : null}

        {/* Recent activity. */}
        <section className="dash__section">
          <SectionLabel
            action={
              <button type="button" className="t-micro" onClick={() => navigate('/app/activity')}>
                See all
              </button>
            }
          >
            Recent activity
          </SectionLabel>

          {loading ? (
            <div className="stack stack--sm">
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon="activity"
              title="No activity yet"
              body="Payments you send or receive will show up here."
            />
          ) : (
            <Card padded={false} variant="flat" className="dash__list">
              {recent.map((tx, i) => (
                <div key={tx.id}>
                  <TransactionRow tx={tx} onClick={() => navigate(`/app/tx/${encodeURIComponent(tx.id)}`)} />
                  {i < recent.length - 1 ? <Divider /> : null}
                </div>
              ))}
            </Card>
          )}
        </section>
      </ConnectionGate>
    </Screen>
  );
}
