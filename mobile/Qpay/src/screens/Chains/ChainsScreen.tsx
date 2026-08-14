import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AmountDisplay,
  Button,
  Card,
  Divider,
  Icon,
  IconName,
  Screen,
  SectionLabel,
  Skeleton,
  StatusTag,
} from '../../component/ui';
import { ProgressRing, Stagger } from '../../component/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { radii, spacing, typography } from '../../theme/theme';
import { useBalances } from '../../hooks';
import { RootStackParamList } from '../../navigation/types';
import { ConnectionGate } from '../components/ConnectionGate';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Mirrors RedeemScreen's LOT_SIZE — FXRP egress only ever fills in whole
// 10-XRP lots, so "how close to another redeemable lot" is real math, not
// decoration.
const FXRP_LOT_SIZE = 10;

const ZONES: { title: string; body: string; icon: IconName }[] = [
  {
    title: 'Ingress',
    body: 'Real value enters once — XRP, an EVM asset, or a card top-up becomes a Qpay balance.',
    icon: 'arrowDownLeft',
  },
  {
    title: 'The ledger — instant',
    body: 'Every payment between Qpay users is instant and free — this is the whole product.',
    icon: 'activity',
  },
  {
    title: 'Egress — slow, optional',
    body: 'Cashing out is the only slow step, and it only happens when you choose to do it.',
    icon: 'clock',
  },
];

/**
 * mobileAppWorkflow.md §2.8 — per-chain balances, deliberately kept off the
 * main dashboard. Egress for FXRP goes through FAssets redemption
 * (plan.md §5.6): lot-granular and partial-fill aware, surfaced honestly on
 * its own screen (Redeem) rather than a generic "withdraw" button here.
 */
export default function ChainsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { chainBalances, loading, error } = useBalances();

  return (
    <Screen title="Chains">
      <Text style={[typography.body, styles.lede, { color: theme.muted }]}>
        Payments settle instantly between Qpay balances. Moving value on or off Flare is the only
        slow step — and it is optional.
      </Text>

      <SectionLabel>How money moves</SectionLabel>
      <Card variant="flat" style={styles.zoneCard}>
        <Stagger interval={50}>
          {ZONES.map((zone) => (
            <View key={zone.title} style={styles.zoneRow}>
              <View style={[styles.zoneIcon, { borderColor: theme.border }]}>
                <Icon name={zone.icon} size={16} color={theme.ink} />
              </View>
              <View style={styles.zoneText}>
                <Text style={[typography.bodyMedium, { color: theme.ink }]}>{zone.title}</Text>
                <Text style={[typography.label, styles.zoneBody, { color: theme.muted }]}>{zone.body}</Text>
              </View>
            </View>
          ))}
        </Stagger>
      </Card>

      <SectionLabel>Balances</SectionLabel>
      <ConnectionGate error={error}>
        {loading && chainBalances.length === 0 ? (
          <View style={styles.list}>
            <Skeleton height={92} />
            <Skeleton height={92} />
            <Skeleton height={92} />
          </View>
        ) : (
          <View style={styles.list}>
            <Stagger interval={50} distance={14}>
              {chainBalances.map((b) => (
                <Card key={b.asset} padded={false} style={styles.chainCard}>
                  <View style={styles.chainHead}>
                    <View style={styles.chainName}>
                      <Text style={[typography.subtitle, { color: theme.ink }]}>{b.label}</Text>
                      <Text style={[typography.micro, { color: theme.muted }]}>{b.asset}</Text>
                    </View>
                    <AmountDisplay value={b.balance} asset="" />
                  </View>

                  {b.asset === 'FXRP' ? <FxrpLotProgress balance={b.balance} /> : null}

                  <Divider />

                  <View style={styles.chainFoot}>
                    <Text style={[typography.label, styles.egress, { color: theme.muted }]}>
                      {b.egressLabel}
                    </Text>
                    {b.asset === 'FXRP' ? (
                      <View style={styles.fxrpActions}>
                        <Button
                          label="Deposit"
                          variant="secondary"
                          onPress={() => navigation.navigate('Deposit')}
                        />
                        <Button label="Redeem" variant="secondary" onPress={() => navigation.navigate('Redeem')} />
                      </View>
                    ) : (
                      <StatusTag label="Egress not built yet" />
                    )}
                  </View>
                </Card>
              ))}
            </Stagger>
          </View>
        )}
      </ConnectionGate>
    </Screen>
  );
}

/** How close this FXRP balance is to another whole, redeemable 10-XRP lot. */
function FxrpLotProgress({ balance }: { balance: number }) {
  const theme = useTheme();
  const lotsReady = Math.floor(balance / FXRP_LOT_SIZE);
  const remainder = Math.max(0, balance - lotsReady * FXRP_LOT_SIZE);
  const progress = Math.min(1, remainder / FXRP_LOT_SIZE);

  return (
    <View style={styles.lotRow}>
      <ProgressRing progress={progress} size={36} strokeWidth={4} />
      <View style={styles.lotText}>
        <Text style={[typography.label, { color: theme.ink }]}>
          {lotsReady} lot{lotsReady === 1 ? '' : 's'} ready to redeem
        </Text>
        <Text style={[typography.micro, { color: theme.muted }]}>
          {remainder.toFixed(2)} toward the next {FXRP_LOT_SIZE}-XRP lot
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lede: { marginBottom: spacing.xl, lineHeight: 21 },
  zoneCard: { marginBottom: spacing.xl, gap: spacing.md },
  zoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  zoneIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  zoneText: { flex: 1 },
  zoneBody: { marginTop: 2, lineHeight: 17 },
  list: { gap: spacing.md, marginBottom: spacing.md },
  chainCard: {},
  chainHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  chainName: { gap: 2 },
  lotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  lotText: { flex: 1, gap: 1 },
  chainFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
  },
  fxrpActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  egress: { flex: 1 },
});
