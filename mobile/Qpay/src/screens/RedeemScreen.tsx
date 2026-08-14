import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AmountDisplay,
  Button,
  Card,
  Divider,
  Input,
  Screen,
  StatusTag,
} from '../component/ui';
import { FadeIn, ProgressRing, SlideIn, haptic } from '../component/motion';
import { useTheme } from '../theme/ThemeProvider';
import { motion, spacing, typography } from '../theme/theme';
import { RootStackParamList } from '../navigation/types';
import { useBalances, usePay } from '../hooks';
import { useQpayContext } from '../context/QpayProvider';
import { BelowLotSizeError, InsufficientBalanceError, Transaction } from '../services/qpayService';
import { ConnectionGate } from './components/ConnectionGate';

type Props = NativeStackScreenProps<RootStackParamList, 'Redeem'>;

const LOT_SIZE = 10;

/**
 * New screen — FXRP → real XRP via FAssets redemption (plan.md §5.6).
 * Lot-granular, partial-fill aware; every number shown here is derived from
 * the same lot math the mock service enforces, never a rounded-up promise.
 */
export default function RedeemScreen({ navigation }: Props) {
  const theme = useTheme();
  const { error: qpayError } = useQpayContext();
  const { data: balances } = useBalances();
  const { redeemFxrp, loading } = usePay();
  const [amount, setAmount] = useState('');
  const [xrplAddress, setXrplAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [simulatePartial, setSimulatePartial] = useState(false);
  const [result, setResult] = useState<{ tx: Transaction; requestedLots: number; remainder: number } | null>(
    null,
  );

  const fxrpBalance = balances?.FXRP ?? null;
  const amountValue = Number(amount) || 0;
  const lots = Math.floor(amountValue / LOT_SIZE);
  const requestedExact = lots * LOT_SIZE;
  const remainder = Math.max(0, amountValue - requestedExact);
  const redeemableRatio = amountValue > 0 ? Math.min(1, requestedExact / amountValue) : 0;
  const belowLot = amountValue > 0 && lots < 1;
  const overBalance = fxrpBalance != null && requestedExact > fxrpBalance;
  const canSubmit = lots >= 1 && !!xrplAddress.trim() && !overBalance;

  const submit = async () => {
    setError(null);
    haptic('tap');
    try {
      const tx = await redeemFxrp(amountValue, xrplAddress.trim(), {
        simulatePartialFill: simulatePartial,
      });
      setResult({ tx, requestedLots: lots, remainder });
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

  const toggleSimulate = () => {
    haptic('select');
    setSimulatePartial((v) => !v);
  };

  if (result) {
    const { tx, requestedLots, remainder: preRemainder } = result;
    const filledLots = tx.amount / LOT_SIZE;
    const unfilledLots = requestedLots - filledLots;
    const isPartial = tx.status === 'partial';
    const fillRatio = requestedLots > 0 ? filledLots / requestedLots : 1;

    return (
      <Screen
        title="Redeemed"
        footer={<Button label="Done" onPress={() => navigation.goBack()} />}
      >
        <RedeemResultHaptic isPartial={isPartial} />
        <View style={styles.doneBlock}>
          <AmountDisplay
            value={tx.amount}
            asset="XRP"
            size="display"
            caption={isPartial ? 'Partially filled — sent to XRPL' : 'Sent to XRPL'}
          />
          {isPartial ? <StatusTag label="Partial fill" emphasis="solid" /> : null}
        </View>

        <FadeIn delay={120}>
          <Card style={styles.ringCard}>
            <ProgressRing progress={fillRatio} size={64} strokeWidth={6} />
            <View style={styles.ringText}>
              <Text style={[typography.bodyMedium, { color: theme.ink }]}>
                {filledLots} of {requestedLots} lots filled
              </Text>
              <Text style={[typography.label, { color: theme.muted }]}>
                {Math.round(fillRatio * 100)}% of this redemption request
              </Text>
            </View>
          </Card>
        </FadeIn>

        <Card padded={false} style={styles.breakdown}>
          <BreakRow label="Lots filled" value={`${filledLots} of ${requestedLots}`} />
          <Divider />
          <BreakRow label="Sent to XRPL" value={`${tx.amount.toFixed(2)} XRP`} />
          {isPartial ? (
            <>
              <Divider />
              <BreakRow
                label="Unfilled lots"
                value={`${unfilledLots} × ${LOT_SIZE} — never debited, still spendable`}
              />
            </>
          ) : null}
          {preRemainder > 0 ? (
            <>
              <Divider />
              <BreakRow label="Sub-lot remainder" value={`${preRemainder.toFixed(2)} FXRP stays spendable`} />
            </>
          ) : null}
        </Card>

        {isPartial ? (
          <Text style={[typography.label, styles.partialNote, { color: theme.muted }]}>
            Agent tickets ran out before your full request could fill. The unfilled lots were
            never debited from your balance — retry to redeem them separately.
          </Text>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen title="Redeem FXRP" onBack={() => navigation.goBack()}>
      <Text style={[typography.body, styles.lede, { color: theme.muted }]}>
        Redeem FXRP for real XRP on the XRP Ledger. This is the only slow step in Qpay — internal
        payments are instant, this takes minutes because it crosses to another chain.
      </Text>

      <Card variant="flat" style={styles.noticeCard}>
        <Text style={[typography.body, styles.notice, { color: theme.ink }]}>
          Redemption works in whole {LOT_SIZE}-XRP lots. Anything below one lot stays in your
          balance and remains spendable. Amounts above a lot boundary redeem in full lots — the
          remainder stays spendable too.
        </Text>
      </Card>

      <ConnectionGate error={qpayError}>
        <Input
          label="Amount"
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            setError(null);
          }}
          placeholder="0.00"
          keyboardType="decimal-pad"
          amount
          suffix="FXRP"
          containerStyle={styles.field}
        />
        <Text style={[typography.label, styles.balanceHint, { color: theme.muted }]}>
          Available: {fxrpBalance != null ? fxrpBalance.toFixed(2) : '—'} FXRP
        </Text>

        {amountValue > 0 && (
          <SlideIn duration={motion.durations.base} distance={10}>
            <Card style={styles.ringCard}>
              <ProgressRing progress={redeemableRatio} size={48} strokeWidth={5} />
              <View style={styles.ringText}>
                <Text style={[typography.bodyMedium, { color: theme.ink }]}>
                  {requestedExact.toFixed(2)} XRP redeems now
                </Text>
                <Text style={[typography.label, { color: theme.muted }]}>
                  {remainder.toFixed(2)} FXRP stays spendable, below lot size
                </Text>
              </View>
            </Card>
            <Card padded={false} style={styles.breakdown}>
              <BreakRow label="Lots redeemed" value={`${lots} × ${LOT_SIZE} XRP`} />
              <Divider />
              <BreakRow label="Sent to XRPL" value={`${requestedExact.toFixed(2)} XRP`} />
              <Divider />
              <BreakRow label="Stays spendable" value={`${remainder.toFixed(2)} FXRP`} />
            </Card>
          </SlideIn>
        )}

        {belowLot ? (
          <Text style={[typography.label, styles.warn, { color: theme.muted }]}>
            Below one lot — enter at least {LOT_SIZE} FXRP to redeem anything.
          </Text>
        ) : null}
        {overBalance ? (
          <Text style={[typography.label, styles.warn, { color: theme.muted }]}>
            That's more than your available FXRP balance.
          </Text>
        ) : null}

        <Input
          label="Destination XRPL address"
          value={xrplAddress}
          onChangeText={setXrplAddress}
          placeholder="r..."
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={styles.field}
        />

        <View style={styles.tagRow}>
          <StatusTag label="Takes minutes, not seconds" />
        </View>

        <Card onPress={toggleSimulate} selected={simulatePartial} style={styles.demoCard}>
          <Text
            style={[
              typography.label,
              { color: simulatePartial ? theme.paper : theme.ink },
            ]}
          >
            Demo: simulate a partial fill
          </Text>
          <Text
            style={[
              typography.label,
              styles.demoBody,
              { color: simulatePartial ? theme.paper : theme.muted },
            ]}
          >
            Agent tickets can run out on a real redemption — flip this to preview that outcome.
          </Text>
        </Card>

        {error ? (
          <FadeIn>
            <Card variant="outlined" style={styles.errorCard}>
              <Text style={[typography.body, { color: theme.ink }]}>{error}</Text>
            </Card>
          </FadeIn>
        ) : null}

        <Button
          label="Confirm redemption"
          onPress={submit}
          loading={loading}
          disabled={!canSubmit}
          style={styles.confirm}
        />
      </ConnectionGate>
    </Screen>
  );
}

/** Fires exactly once when the redemption result mounts — success for a full fill, warning for a partial one. */
function RedeemResultHaptic({ isPartial }: { isPartial: boolean }) {
  useEffect(() => {
    haptic(isPartial ? 'warning' : 'success');
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function BreakRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.breakRow}>
      <Text style={[typography.label, { color: theme.muted }]}>{label}</Text>
      <Text style={[typography.bodyMedium, styles.breakValue, { color: theme.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lede: { marginBottom: spacing.lg, lineHeight: 21 },
  noticeCard: { marginBottom: spacing.lg },
  notice: { lineHeight: 21 },
  field: { marginBottom: spacing.xs },
  balanceHint: { marginBottom: spacing.lg },
  ringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  ringText: { flex: 1, gap: 2 },
  breakdown: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  breakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  breakValue: { flexShrink: 1, textAlign: 'right' },
  warn: { marginBottom: spacing.md },
  tagRow: { marginBottom: spacing.lg },
  demoCard: { marginBottom: spacing.lg },
  demoBody: { marginTop: spacing.xs, lineHeight: 17 },
  errorCard: { marginBottom: spacing.lg },
  confirm: { marginBottom: spacing.md },
  doneBlock: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl },
  partialNote: { marginTop: spacing.md, lineHeight: 18 },
});
