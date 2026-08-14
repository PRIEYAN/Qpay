import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
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
} from '../../component/ui';
import { PressableScale, Stagger, haptic } from '../../component/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { radii, spacing, typography } from '../../theme/theme';
import { useQpayContext } from '../../context/QpayProvider';
import { Business, Contact, Transaction } from '../../services/qpayService';
import { DashboardTabParamList, RootStackParamList } from '../../navigation/types';
import { ConnectionGate } from '../components/ConnectionGate';
import { TransactionRow } from '../components/TransactionRow';

// Dashboard sits inside the bottom-tab navigator, itself nested inside the
// root stack — some destinations (Chains/Profile/Logs) are sibling tabs,
// others (Send/Request/QrScanner/ContactPicker/Redeem/Settings) live one
// level up on the root stack, hence the composite nav type.
type DashboardNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<DashboardTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** Favourites first, then most-recently-paid first; never-paid contacts sink to the bottom. */
function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    if (a.favourite !== b.favourite) return a.favourite ? -1 : 1;
    return (b.lastPaidAt ?? 0) - (a.lastPaidAt ?? 0);
  });
}

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigation>();
  const theme = useTheme();
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

  const openSend = (contact: { name: string; qpayId: string }) =>
    navigation.navigate('Send', { username: contact.name, qpayId: contact.qpayId });

  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.ink} />}
      >
        {/* Top bar — square avatar into Profile, wordmark, settings into the root stack. */}
        <View style={styles.topBar}>
          <PressableScale
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <Avatar name={snapshot?.profile.displayName ?? snapshot?.profile.username ?? ''} size={40} />
          </PressableScale>
          <Text style={[typography.title, { color: theme.ink }]}>Qpay</Text>
          <PressableScale
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={12}
          >
            <Icon name="settings" size={24} color={theme.ink} />
          </PressableScale>
        </View>

        <View style={styles.searchWrap}>
          <SearchBar
            value=""
            onChangeText={() => {}}
            placeholder="Pay anyone, any business"
            onFocus={() => navigation.navigate('ContactPicker', { mode: 'send' })}
          />
        </View>

        <ConnectionGate error={error}>
          {/* Balance — the screen's subject. */}
          <Card variant="flat" style={styles.balanceCard}>
            {loading ? (
              <View style={styles.balanceSkeleton}>
                <Skeleton width={180} height={44} />
                <Skeleton width={120} height={14} style={styles.balanceSkeletonGap} />
              </View>
            ) : (
              <AmountDisplay
                value={balanceAmount}
                asset={balanceAsset}
                size="display"
                caption="Available to spend"
              />
            )}
            <PressableScale
              onPress={() => navigation.navigate('Chains')}
              accessibilityRole="button"
              style={styles.chainsLink}
            >
              <Text style={[typography.label, { color: theme.muted }]}>View chain balances</Text>
              <Icon name="chevronRight" size={16} color={theme.muted} />
            </PressableScale>
          </Card>

          {/* Primary actions. */}
          <View style={styles.actionRow}>
            <Stagger interval={40} itemStyle={styles.actionItem}>
              <ActionTile icon="scan" label="Scan" onPress={() => navigation.navigate('QrScanner')} />
              <ActionTile
                icon="send"
                label="Send"
                onPress={() => navigation.navigate('ContactPicker', { mode: 'send' })}
              />
              <ActionTile icon="request" label="Request" onPress={() => navigation.navigate('Request')} />
              <ActionTile
                icon="arrowDownLeft"
                label="Deposit"
                onPress={() => navigation.navigate('Deposit')}
              />
              <ActionTile icon="wallet" label="Redeem" onPress={() => navigation.navigate('Redeem')} />
            </Stagger>
          </View>

          {/* People. */}
          <View style={styles.section}>
            <SectionLabel>People</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <PressableScale
                onPress={() => navigation.navigate('ContactPicker', { mode: 'send' })}
                accessibilityRole="button"
                accessibilityLabel="New contact"
                style={styles.newChip}
              >
                <View style={[styles.newAvatar, { borderColor: theme.ink }]}>
                  <Icon name="plus" size={22} color={theme.ink} />
                </View>
                <Text style={[typography.label, { color: theme.ink }]}>New</Text>
              </PressableScale>

              <Stagger interval={35} direction="right" distance={10}>
                {people.map((contact) => (
                  <ContactChip
                    key={contact.id}
                    name={contact.name}
                    subtitle={contact.favourite ? 'Favourite' : undefined}
                    onPress={() => openSend(contact)}
                  />
                ))}
              </Stagger>
            </ScrollView>
          </View>

          {/* Businesses. */}
          {businesses.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel>Businesses</SectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Stagger interval={35} direction="right" distance={10}>
                  {businesses.map((business) => (
                    <ContactChip
                      key={business.id}
                      name={business.name}
                      subtitle={business.category}
                      onPress={() => openSend(business)}
                    />
                  ))}
                </Stagger>
              </ScrollView>
            </View>
          ) : null}

          {/* Recent activity. */}
          <View style={styles.section}>
            <SectionLabel
              action={
                <PressableScale onPress={() => navigation.navigate('Logs')} accessibilityRole="button">
                  <Text style={[typography.micro, { color: theme.ink }]}>SEE ALL</Text>
                </PressableScale>
              }
            >
              Recent activity
            </SectionLabel>

            {loading ? (
              <View style={styles.activitySkeleton}>
                <Skeleton height={56} />
                <Skeleton height={56} />
                <Skeleton height={56} />
              </View>
            ) : recent.length === 0 ? (
              <EmptyState
                icon="activity"
                title="No activity yet"
                body="Payments you send or receive will show up here."
              />
            ) : (
              <Card padded={false} style={styles.listCard}>
                {recent.map((tx, i) => (
                  <View key={tx.id}>
                    <TransactionRow
                      tx={tx}
                      index={i}
                      onPress={() => navigation.navigate('TransactionDetail', { id: tx.id })}
                    />
                    {i < recent.length - 1 ? <Divider /> : null}
                  </View>
                ))}
              </Card>
            )}
          </View>
        </ConnectionGate>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  searchWrap: { marginBottom: spacing.lg },
  balanceCard: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.lg },
  balanceSkeleton: { alignItems: 'center' },
  balanceSkeletonGap: { marginTop: spacing.sm },
  chainsLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  actionItem: { flex: 1 },
  section: { marginBottom: spacing.xl },
  chipRow: { flexDirection: 'row', gap: spacing.md, paddingRight: spacing.lg },
  newChip: { width: 72, alignItems: 'center', gap: spacing.xs },
  newAvatar: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: { paddingHorizontal: spacing.md },
  activitySkeleton: { gap: spacing.sm },
});
