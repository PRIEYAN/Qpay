import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  ListRow,
  Screen,
  SearchBar,
  SectionLabel,
  Sheet,
  Skeleton,
} from '../components/ui';
import { Stagger } from '../components/motion';
import { useQpayContext } from '../context/QpayProvider';
import { getBusinesses, searchContacts } from '../services/qpayService';
import type { Business, Contact } from '../services/types';
import { formatRelativeTime, truncateAddress } from '../utils';
import { ConnectionGate } from './components/ConnectionGate';

/**
 * Contact/business/manual-entry picker shared by Send and Request. Sections
 * mirror GPay's "who do you want to pay/request" screen: Favourites, Recent,
 * All contacts, Businesses, plus manual Qpay-ID entry for unknown
 * recipients.
 *
 * The mobile build needed an in-memory module variable to hand the chosen
 * contact back to RequestScreen (its nav route took no params). On the web
 * the URL carries it, so the picker simply navigates with query params and
 * that bridge is gone.
 */
export default function ContactPickerScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'request' ? 'request' : 'send';
  const { snapshot, error } = useQpayContext();

  const [query, setQuery] = useState('');
  const [contactResults, setContactResults] = useState<Contact[] | null>(null);
  const [businessResults, setBusinessResults] = useState<Business[] | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualId, setManualId] = useState('');

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;

  useEffect(() => {
    if (!trimmed) {
      setContactResults(null);
      setBusinessResults(null);
      return;
    }
    let active = true;
    // Results are cleared immediately so the list shows an in-flight
    // skeleton the instant a keystroke lands, rather than the previous
    // query's rows lingering until the new search resolves.
    setContactResults(null);
    setBusinessResults(null);

    void searchContacts(trimmed).then((rows) => {
      if (active) setContactResults(rows);
    });
    void getBusinesses().then((rows) => {
      if (!active) return;
      const q = trimmed.toLowerCase();
      setBusinessResults(
        rows.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.qpayId.toLowerCase().includes(q) ||
            b.category.toLowerCase().includes(q),
        ),
      );
    });

    return () => {
      active = false;
    };
  }, [trimmed]);

  const contacts = useMemo(() => snapshot?.contacts ?? [], [snapshot]);
  const businesses = snapshot?.businesses ?? [];

  const favourites = useMemo(() => contacts.filter((c) => c.favourite), [contacts]);
  const recent = useMemo(() => {
    const paid = contacts.filter((c) => c.lastPaidAt != null);
    return [...paid]
      .sort((a, b) => (b.lastPaidAt as number) - (a.lastPaidAt as number))
      .slice(0, 8);
  }, [contacts]);
  const allContacts = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name)),
    [contacts],
  );

  const shownContacts = contactResults ?? [];
  const shownBusinesses = businessResults ?? [];
  const searchLoaded = contactResults !== null && businessResults !== null;
  const noResults =
    isSearching && searchLoaded && shownContacts.length === 0 && shownBusinesses.length === 0;

  function goToRecipient(qpayId: string, name: string) {
    const target = mode === 'request' ? '/app/request' : '/app/send';
    navigate(`${target}?to=${encodeURIComponent(qpayId)}&name=${encodeURIComponent(name)}`);
  }

  function submitManual() {
    const id = manualId.trim();
    if (!id) return;
    goToRecipient(id, id);
    setManualOpen(false);
    setManualId('');
  }

  const contactRow = (contact: Contact) => (
    <ListRow
      key={contact.id}
      title={contact.name}
      subtitle={
        contact.lastPaidAt
          ? `Paid ${formatRelativeTime(contact.lastPaidAt)}`
          : truncateAddress(contact.qpayId)
      }
      onClick={() => goToRecipient(contact.qpayId, contact.name)}
    />
  );

  return (
    <Screen
      title={mode === 'request' ? 'Request from' : 'Pay someone'}
      onBack={() => navigate(-1)}
    >
      <div className="stack stack--md">
        <SearchBar value={query} onChange={setQuery} placeholder="Search name or Qpay ID" autoFocus />

        <Card onClick={() => setManualOpen(true)}>
          <span className="cluster" style={{ gap: 'var(--space-md)' }}>
            <span
              style={{
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                border: 'var(--border-width) solid var(--ink)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Icon name="plus" size={16} />
            </span>
            <span className="t-body-medium">
              {mode === 'request' ? 'Request from a Qpay ID' : 'Pay to a Qpay ID'}
            </span>
          </span>
        </Card>

        <ConnectionGate error={error}>
          {isSearching ? (
            !searchLoaded ? (
              <div className="stack stack--sm">
                <Skeleton height={56} />
                <Skeleton height={56} />
              </div>
            ) : noResults ? (
              <EmptyState
                icon="search"
                title="No matches"
                body="Nobody by that name or Qpay ID. You can still pay the address directly."
                action={<Button label="Pay to a Qpay ID" onClick={() => setManualOpen(true)} />}
              />
            ) : (
              <div className="stack stack--md">
                {shownContacts.length > 0 ? (
                  <section>
                    <SectionLabel>People</SectionLabel>
                    <Stagger interval={25}>{shownContacts.map(contactRow)}</Stagger>
                  </section>
                ) : null}

                {shownBusinesses.length > 0 ? (
                  <section>
                    <SectionLabel>Businesses</SectionLabel>
                    <Stagger interval={25}>
                      {shownBusinesses.map((business) => (
                        <ListRow
                          key={business.id}
                          title={business.name}
                          subtitle={business.category}
                          onClick={() => goToRecipient(business.qpayId, business.name)}
                        />
                      ))}
                    </Stagger>
                  </section>
                ) : null}
              </div>
            )
          ) : contacts.length === 0 && businesses.length === 0 ? (
            <EmptyState
              icon="contacts"
              title="No contacts yet"
              body="Contacts appear here once you've paid someone. You can pay any Qpay ID directly in the meantime."
              action={<Button label="Pay to a Qpay ID" onClick={() => setManualOpen(true)} />}
            />
          ) : (
            <div className="stack stack--md">
              {favourites.length > 0 ? (
                <section>
                  <SectionLabel>Favourites</SectionLabel>
                  {favourites.map(contactRow)}
                </section>
              ) : null}

              {recent.length > 0 ? (
                <section>
                  <SectionLabel>Recent</SectionLabel>
                  {recent.map(contactRow)}
                </section>
              ) : null}

              {allContacts.length > 0 ? (
                <section>
                  <SectionLabel>All contacts</SectionLabel>
                  {allContacts.map(contactRow)}
                </section>
              ) : null}

              {businesses.length > 0 ? (
                <section>
                  <SectionLabel>Businesses</SectionLabel>
                  {businesses.map((business) => (
                    <ListRow
                      key={business.id}
                      title={business.name}
                      subtitle={business.category}
                      onClick={() => goToRecipient(business.qpayId, business.name)}
                    />
                  ))}
                </section>
              ) : null}
            </div>
          )}
        </ConnectionGate>
      </div>

      <Sheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title={mode === 'request' ? 'Request from a Qpay ID' : 'Pay to a Qpay ID'}
      >
        <div className="stack stack--md">
          <Input
            label="Qpay ID or wallet address"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="0x…"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitManual();
            }}
          />
          <Button label="Continue" onClick={submitManual} disabled={!manualId.trim()} />
        </div>
      </Sheet>
    </Screen>
  );
}
