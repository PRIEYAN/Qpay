import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AmountDisplay,
  Avatar,
  Button,
  Card,
  Icon,
  Input,
  KeypadNumeric,
  Row,
  Screen,
} from '../component/ui';
import { FadeIn, SlideIn, haptic } from '../component/motion';
import { useTheme } from '../theme/ThemeProvider';
import { motion, spacing, typography } from '../theme/theme';
import { RootStackParamList } from '../navigation/types';
import { useQpayContext } from '../context/QpayProvider';
import { usePay, useBalances } from '../hooks';
import {
  InsufficientBalanceError,
  InvalidAmountError,
  PrimaryAsset,
  quoteConversion,
} from '../services/qpayService';
import { formatAmount } from '../utils';
import { ConnectionGate } from './components/ConnectionGate';

type Props = NativeStackScreenProps<RootStackParamList, 'Send'>;

type Step = 'amount' | 'confirm' | 'success';

/**
 * Google Pay style single-screen flow: amount (big keypad-driven readout) ->
 * confirm (You send / They receive / fee / settlement) -> success. Arrives
 * either pre-addressed (from ContactPicker or a QR scan, via route.params)
 * or with no recipient at all, in which case it hands off to ContactPicker
 * before rendering anything else.
 */
export default function SendScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { snapshot, error: qpayError } = useQpayContext();
  const { primaryAsset, primaryBalance } = useBalances();
  const { pay } = usePay();

  const paramUsername = route.params?.username;
  const paramQpayId = route.params?.qpayId;
  const hasRecipient = !!(paramUsername || paramQpayId);

  useEffect(() => {
    if (!hasRecipient) {
      navigation.replace('ContactPicker', { mode: 'send' });
    }
    // Only re-check when the params identity actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRecipient]);

  const [step, setStep] = useState<Step>('amount');
  const [amountStr, setAmountStr] = useState(
    route.params?.amount != null ? String(route.params.amount) : '',
  );
  const [note, setNote] = useState(route.params?.note ?? '');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  const contactMatch = useMemo(
    () =>
      snapshot?.contacts.find(
        (c) => (paramQpayId && c.qpayId === paramQpayId) || (paramUsername && c.name === paramUsername),
      ) ?? null,
    [snapshot, paramQpayId, paramUsername],
  );
  const businessMatch = useMemo(
    () =>
      !contactMatch
        ? snapshot?.businesses.find(
            (b) => (paramQpayId && b.qpayId === paramQpayId) || (paramUsername && b.name === paramUsername),
          ) ?? null
        : null,
    [snapshot, contactMatch, paramQpayId, paramUsername],
  );

  const recipientName = contactMatch?.name ?? businessMatch?.name ?? paramUsername ?? paramQpayId ?? '';
  const recipientQpayId = contactMatch?.qpayId ?? businessMatch?.qpayId ?? paramQpayId ?? '';
  const recipientTo = recipientQpayId || recipientName;

  const senderAsset: PrimaryAsset = primaryAsset ?? 'FXRP';
  const recipientAsset: PrimaryAsset = contactMatch?.primaryAsset ?? businessMatch?.primaryAsset ?? senderAsset;

  const amountValue = amountStr ? Number(amountStr) : 0;
  const exceedsBalance = primaryBalance != null && amountValue > primaryBalance;
  const canContinue = hasRecipient && amountValue > 0 && !exceedsBalance;

  const quote = useMemo(
    () => quoteConversion(amountValue, senderAsset, recipientAsset),
    [amountValue, senderAsset, recipientAsset],
  );

  async function handleConfirm() {
    setError(null);
    setPaying(true);
    haptic('tap');
    try {
      const tx = await pay(recipientTo, amountValue, `send-${Date.now()}`, note.trim() ? { note: note.trim() } : undefined);
      setTxId(tx.id);
      setStep('success');
    } catch (e) {
      haptic('warning');
      if (e instanceof InsufficientBalanceError) {
        setError(`Not enough ${e.asset}. You have ${formatAmount(e.available, e.asset)}.`);
      } else if (e instanceof InvalidAmountError) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setPaying(false);
    }
  }

  if (!hasRecipient) {
    return <Screen title="Send" onBack={() => navigation.goBack()}><View /></Screen>;
  }

  if (step === 'success') {
    return (
      <Screen
        footer={
          <View style={styles.successFooter}>
            <Button label="Done" onPress={() => navigation.popToTop()} />
            <Button
              label="View details"
              variant="ghost"
              onPress={() => txId && navigation.navigate('TransactionDetail', { id: txId })}
              disabled={!txId}
            />
          </View>
        }
      >
        <View style={styles.successBlock}>
          <SuccessBadge />
          <FadeIn delay={220}>
            <AmountDisplay
              value={amountValue}
              asset={senderAsset}
              caption={`to ${recipientName}`}
              size="display"
            />
          </FadeIn>
        </View>
      </Screen>
    );
  }

  if (step === 'confirm') {
    return (
      <Screen
        title="Confirm"
        onBack={() => setStep('amount')}
        footer={
          <View style={styles.confirmFooter}>
            {error ? <Notice message={error} /> : null}
            <Button label="Confirm & pay" onPress={handleConfirm} loading={paying} />
          </View>
        }
      >
        <RecipientHeader name={recipientName} qpayId={recipientQpayId} />

        {/* A slightly slower, deliberate entrance — this is the moment real money moves. */}
        <SlideIn duration={motion.durations.slow} distance={20}>
          <Card style={styles.detailCard}>
            <Row label="You send" value={formatAmount(amountValue, senderAsset)} />
            <Row label="They receive" value={formatAmount(quote.amountOut, recipientAsset)} />
            {quote.isCrossAsset ? (
              <Text style={[typography.micro, styles.quoteNote, { color: theme.muted }]}>
                1 {senderAsset} ≈ {quote.rate.toFixed(4)} {recipientAsset} · incl. {(quote.spreadBps / 100).toFixed(2)}% swap spread
              </Text>
            ) : null}
            <Row label="Network fee" value="Sponsored — no gas" />
            <Row label="Settles in" value="~1.8s" />
            {note.trim() ? <Row label="Note" value={note.trim()} /> : null}
          </Card>
        </SlideIn>
      </Screen>
    );
  }

  return (
    <Screen
      title="Send"
      onBack={() => navigation.goBack()}
      footer={<Button label="Continue" onPress={() => setStep('confirm')} disabled={!canContinue} />}
    >
      <ConnectionGate error={qpayError}>
        <RecipientHeader name={recipientName} qpayId={recipientQpayId} />

        <View style={styles.amountBlock}>
          <AmountDisplay value={amountValue} asset={senderAsset} size="display" />
        </View>

        {exceedsBalance ? (
          <Notice
            message={`Exceeds your balance of ${formatAmount(primaryBalance ?? 0, senderAsset)}`}
          />
        ) : null}

        <Input
          label="Add a note"
          value={note}
          onChangeText={setNote}
          placeholder="What's it for?"
          containerStyle={styles.noteField}
        />

        <KeypadNumeric value={amountStr} onChange={setAmountStr} />
      </ConnectionGate>
    </Screen>
  );
}

/** Springs the check mark up + fades it in, and fires the success haptic exactly once on mount. */
function SuccessBadge() {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    haptic('success');
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, ...motion.spring.gentle }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.durations.base,
        easing: motion.easing.decelerate,
        useNativeDriver: true,
      }),
    ]).start();
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[styles.successIcon, { backgroundColor: theme.ink, opacity, transform: [{ scale }] }]}
    >
      <Icon name="check" size={40} color={theme.paper} />
    </Animated.View>
  );
}

function RecipientHeader({ name, qpayId }: { name: string; qpayId: string }) {
  const theme = useTheme();
  return (
    <View style={styles.recipientRow}>
      <Avatar name={name} size={44} />
      <View style={styles.recipientText}>
        <Text style={[typography.bodyMedium, { color: theme.ink }]} numberOfLines={1}>
          {name}
        </Text>
        {qpayId ? (
          <Text style={[typography.label, { color: theme.muted }]} numberOfLines={1}>
            {qpayId}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Notice({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <FadeIn style={[styles.notice, { borderColor: theme.ink }]}>
      <Icon name="alert" size={16} color={theme.ink} />
      <Text style={[typography.label, styles.noticeText, { color: theme.ink }]}>{message}</Text>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  recipientText: { flex: 1, gap: 2 },
  amountBlock: { alignItems: 'center', paddingVertical: spacing.lg },
  noteField: { marginBottom: spacing.lg },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeText: { flex: 1 },
  detailCard: { gap: 0 },
  quoteNote: { marginTop: -spacing.xs, marginBottom: spacing.sm },
  confirmFooter: { gap: spacing.md },
  successFooter: { gap: spacing.sm },
  successBlock: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xxl },
  successIcon: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
