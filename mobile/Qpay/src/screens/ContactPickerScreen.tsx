import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
} from '../component/ui';
import { Stagger } from '../component/motion';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing, typography } from '../theme/theme';
import { RootStackParamList } from '../navigation/types';
import { useQpayContext } from '../context/QpayProvider';
import { getBusinesses, searchContacts } from '../services/qpayService';
import { Business, Contact } from '../services/types';
import { ConnectionGate } from './components/ConnectionGate';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactPicker'>;

type PendingRequestTarget = { qpayId: string; name: string } | null;

/**
 * `Request: undefined` in the nav contract means we can't pass params when
 * mode === 'request'. This tiny in-memory bridge lets RequestScreen pick up
 * the chosen contact on focus without touching navigation typing — both
 * files are owned by this flow.
 */
let pendingRequestTarget: PendingRequestTarget = null;

export function takePendingRequestTarget(): PendingRequestTarget {
  const value = pendingRequestTarget;
  pendingRequestTarget = null;
  return value;
}

/**
 * Contact/business/manual-entry picker shared by Send and Request. Sections
 * mirror GPay's "who do you want to pay/request" screen: Favourites, Recent,
 * All contacts, Businesses, plus a manual Qpay-ID entry for unknown
 * recipients.
 */
export default function ContactPickerScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const mode = route.params?.mode ?? 'send';
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
    searchContacts(trimmed).then((rows) => {
      if (active) setContactResults(rows);
    });
    getBusinesses().then((rows) => {
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
    return [...paid].sort((a, b) => (b.lastPaidAt as number) - (a.lastPaidAt as number)).slice(0, 8);
  }, [contacts]);
  const allContacts = useMemo(() => [...contacts].sort((a, b) => a.name.localeCompare(b.name)), [contacts]);

  const shownContacts = contactResults ?? [];
  const shownBusinesses = businessResults ?? [];
  const searchLoaded = contactResults !== null && businessResults !== null;
  const noResults = isSearching && searchLoaded && shownContacts.length === 0 && shownBusinesses.length === 0;

  function goToRecipient(qpayId: string, name: string) {
    if (mode === 'request') {
      pendingRequestTarget = { qpayId, name };
      navigation.navigate('Request');
      return;
    }
    navigation.navigate('Send', { username: name, qpayId });
  }

  function submitManual() {
    const id = manualId.trim();
    if (!id) return;
    goToRecipient(id, id);
    setManualOpen(false);
    setManualId('');
  }

  return (
    <Screen title={mode === 'request' ? 'Request from' : 'Pay someone'} onBack={() => navigation.goBack()}>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search name or Qpay ID" />

      <Card onPress={() => setManualOpen(true)} style={styles.manualCard}>
        <View style={styles.manualRow}>
          <View style={[styles.manualIcon, { borderColor: theme.ink }]}>
            <Icon name="plus" size={16} color={theme.ink} />
          </View>
          <Text style={[typography.bodyMedium, { color: theme.ink }]}>Pay to a Qpay ID</Text>
        </View>
      </Card>

      <ConnectionGate error={error}>
        {isSearching ? (
          !searchLoaded ? (
            <View style={styles.searchSkeleton}>
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
            </View>
          ) : (
            <>
              <SectionLabel>Contacts</SectionLabel>
              {shownContacts.length > 0 ? (
                <Stagger interval={30} distance={8}>
                  {shownContacts.map((c) => (
                    <ListRow
                      key={c.id}
                      title={c.name}
                      subtitle={c.qpayId}
                      onPress={() => goToRecipient(c.qpayId, c.name)}
                    />
                  ))}
                </Stagger>
              ) : (
                <Text style={[typography.label, styles.emptyHint, { color: theme.muted }]}>
                  No matching contacts
                </Text>
              )}

              <SectionLabel>Businesses</SectionLabel>
              {shownBusinesses.length > 0 ? (
                <Stagger interval={30} distance={8}>
                  {shownBusinesses.map((b) => (
                    <ListRow
                      key={b.id}
                      title={b.name}
                      subtitle={b.category}
                      onPress={() => goToRecipient(b.qpayId, b.name)}
                    />
                  ))}
                </Stagger>
              ) : (
                <Text style={[typography.label, styles.emptyHint, { color: theme.muted }]}>
                  No matching businesses
                </Text>
              )}

              {noResults ? (
                <EmptyState icon="search" title="No results" body={`Nothing matches "${trimmed}"`} />
              ) : null}
            </>
          )
        ) : (
          <>
            {favourites.length > 0 ? (
              <>
                <SectionLabel>Favourites</SectionLabel>
                <Stagger interval={30} distance={8}>
                  {favourites.map((c) => (
                    <ListRow
                      key={c.id}
                      title={c.name}
                      subtitle={c.qpayId}
                      onPress={() => goToRecipient(c.qpayId, c.name)}
                    />
                  ))}
                </Stagger>
              </>
            ) : null}

            {recent.length > 0 ? (
              <>
                <SectionLabel>Recent</SectionLabel>
                <Stagger interval={30} distance={8}>
                  {recent.map((c) => (
                    <ListRow
                      key={c.id}
                      title={c.name}
                      subtitle={c.qpayId}
                      onPress={() => goToRecipient(c.qpayId, c.name)}
                    />
                  ))}
                </Stagger>
              </>
            ) : null}

            <SectionLabel>All contacts</SectionLabel>
            {allContacts.length > 0 ? (
              <Stagger interval={25} distance={8}>
                {allContacts.map((c) => (
                  <ListRow
                    key={c.id}
                    title={c.name}
                    subtitle={c.qpayId}
                    onPress={() => goToRecipient(c.qpayId, c.name)}
                  />
                ))}
              </Stagger>
            ) : (
              <EmptyState icon="contacts" title="No contacts yet" body="Pay someone by Qpay ID to add them here." />
            )}

            {businesses.length > 0 ? (
              <>
                <SectionLabel>Businesses</SectionLabel>
                <Stagger interval={30} distance={8}>
                  {businesses.map((b) => (
                    <ListRow
                      key={b.id}
                      title={b.name}
                      subtitle={b.category}
                      onPress={() => goToRecipient(b.qpayId, b.name)}
                    />
                  ))}
                </Stagger>
              </>
            ) : null}
          </>
        )}
      </ConnectionGate>

      <Sheet visible={manualOpen} onClose={() => setManualOpen(false)} title="Pay to a Qpay ID">
        <Input
          label="Qpay ID"
          value={manualId}
          onChangeText={setManualId}
          placeholder="name@qpay"
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={styles.manualInput}
        />
        <Button label="Continue" onPress={submitManual} disabled={!manualId.trim()} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  manualCard: { marginTop: spacing.md, marginBottom: spacing.lg },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  manualIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: { paddingVertical: spacing.sm },
  manualInput: { marginBottom: spacing.lg },
  searchSkeleton: { gap: spacing.sm, marginTop: spacing.sm },
});
