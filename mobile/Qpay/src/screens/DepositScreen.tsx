import React, { useCallback, useEffect, useState } from 'react';
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
import { FadeIn, SlideIn, haptic } from '../component/motion';
import { useTheme } from '../theme/ThemeProvider';
import { motion, spacing, typography } from '../theme/theme';
import { RootStackParamList } from '../navigation/types';
import { useBalances, usePay } from '../hooks';
import { useQpayContext } from '../context/QpayProvider';
import {
  InsufficientBalanceError,
  Transaction,
  getWalletFxrpBalance,
} from '../services/qpayService';
import { ConnectionGate } from './components/ConnectionGate';

type Props = NativeStackScreenProps<RootStackParamList, 'Deposit'>;

/**
 * Wallet FXRP -> spendable Qpay balance (QpayLedger.deposit).
 *
 * The ingress counterpart to RedeemScreen. Two balances matter here and they
 * are deliberately shown side by side, because conflating them is the single
 * most confusing thing about a custodial-ledger app: FXRP sitting in your
 * wallet cannot be paid with, and FXRP in the ledger cannot be sent to
 * anyone outside Qpay without redeeming.
 */
export default function DepositScreen({ navigation }: Props) {
  const theme = useTheme();
  const { error: qpayError } = useQpayContext();
  const { data: balances } = useBalances();
  const { depositFxrp, loading } = usePay();
  const [amount, setAmount] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Transaction | null>(null);

  const ledgerBalance = balances?.FXRP ?? null;
  const amountValue = Number(amount) || 0;
  const overWallet = walletBalance != null && amountValue > walletBalance;
  const canSubmit = amountValue > 0 && !overWallet && !loading;

  const refreshWallet = useCallback(async () => {
    try {
      setWalletBalance(await getWalletFxrpBalance());
    } catch {
      // Not connected / not configured — ConnectionGate already explains why;
      // leaving this null renders "—" rather than a fabricated zero.
      setWalletBalance(null);
    }
  }, []);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet, result]);

  const submit = async () => {
    setError(null);
    haptic('tap');
    try {
      const tx = await depositFxrp(amountValue);
      haptic('success');
      setResult(tx);
    } catch (e) {
      haptic('warning');
      if (e instanceof InsufficientBalanceError) {
        setError(`Not enough FXRP in your wallet: need ${e.requested}, have ${e.available}.`);
      } else {
        setError(e instanceof Error ? e.message : 'Deposit failed.');
      }
    }
  };

  const useMax = () => {
    if (walletBalance == null) return;
    haptic('select');
    setAmount(String(walletBalance));
    setError(null);
  };

  if (result) {
    return (
      <Screen title="Deposited" footer={<Button label="Done" onPress={() => navigation.goBack()} />}>
        <View style={styles.doneBlock}>
          <AmountDisplay value={result.amount} asset="FXRP" size="display" caption="Now spendable in Qpay" />
          <StatusTag label="Confirmed on Coston2" emphasis="solid" />
        </View>
        <Card padded={false} style={styles.breakdown}>
          <BreakRow label="Deposited" value={`${result.amount.toFixed(2)} FXRP`} />
          <Divider />
          <BreakRow
            label="Spendable balance"
            value={`${((ledgerBalance ?? 0)).toFixed(2)} FXRP`}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Deposit FXRP" onBack={() => navigation.goBack()}>
      <Text style={[typography.body, styles.lede, { color: theme.muted }]}>
        Move FXRP from your connected wallet into your Qpay balance. Only deposited FXRP can be
        spent on payments — wallet FXRP sits outside the ledger until you do this.
      </Text>

      <ConnectionGate error={qpayError}>
        <Card padded={false} style={styles.breakdown}>
          <BreakRow
            label="In your wallet"
            value={walletBalance != null ? `${walletBalance.toFixed(2)} FXRP` : '—'}
          />
          <Divider />
          <BreakRow
            label="Spendable in Qpay"
            value={ledgerBalance != null ? `${ledgerBalance.toFixed(2)} FXRP` : '—'}
          />
        </Card>

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
        <View style={styles.maxRow}>
          <Text style={[typography.label, { color: theme.muted }]}>
            Available: {walletBalance != null ? walletBalance.toFixed(2) : '—'} FXRP
          </Text>
          <Button label="Max" variant="secondary" onPress={useMax} disabled={!walletBalance} />
        </View>

        {overWallet ? (
          <Text style={[typography.label, styles.warn, { color: theme.muted }]}>
            That's more FXRP than your wallet holds.
          </Text>
        ) : null}

        {amountValue > 0 && !overWallet ? (
          <SlideIn duration={motion.durations.base} distance={10}>
            <Card variant="flat" style={styles.noticeCard}>
              <Text style={[typography.body, styles.notice, { color: theme.ink }]}>
                Your wallet will ask you to sign up to two transactions: an FXRP approval for this
                exact amount (skipped if you've already approved enough), then the deposit itself.
              </Text>
            </Card>
          </SlideIn>
        ) : null}

        {error ? (
          <FadeIn>
            <Card variant="outlined" style={styles.errorCard}>
              <Text style={[typography.body, { color: theme.ink }]}>{error}</Text>
            </Card>
          </FadeIn>
        ) : null}

        <Button
          label="Deposit"
          onPress={submit}
          loading={loading}
          disabled={!canSubmit}
          style={styles.confirm}
        />
      </ConnectionGate>
    </Screen>
  );
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
  maxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
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
  errorCard: { marginBottom: spacing.lg },
  confirm: { marginBottom: spacing.md },
  doneBlock: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl },
});
