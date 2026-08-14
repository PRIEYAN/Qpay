import React, { useMemo, useState } from 'react';
import { Clipboard, Linking, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AmountDisplay, Avatar, Card, Divider, Icon, Row, Screen, SectionLabel, StatusTag, Toast } from '../component/ui';
import { FadeIn, SlideIn, haptic } from '../component/motion';
import { useTheme } from '../theme/ThemeProvider';
import { radii, spacing, typography } from '../theme/theme';
import { RootStackParamList } from '../navigation/types';
import { useTransactions } from '../hooks';
import { formatAmount, truncateAddress } from '../utils';
import { ConnectionGate } from './components/ConnectionGate';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;

const OUTGOING = new Set(['sent', 'egress']);
const LOT_SIZE = 10;

function directionLabel(direction: string): string {
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

function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'pending':
      return 'Pending';
    case 'partial':
      return 'Partial fill';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

/**
 * mobileAppWorkflow.md §2.9 — the receipts screen: every row that can prove
 * itself against the ledger does, right down to the tx hash and explorer
 * link. Reads from the already-loaded snapshot via useTransactions rather
 * than a dedicated fetch-by-id call (qpayService has none).
 */
export default function TransactionDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { data: transactions, error } = useTransactions();
  const [toast, setToast] = useState(false);

  const tx = useMemo(
    () => transactions.find((t) => t.id === route.params.id),
    [transactions, route.params.id],
  );

  const copy = (value: string) => {
    haptic('select');
    Clipboard.setString(value);
    setToast(true);
    setTimeout(() => setToast(false), 1500);
  };

  if (!tx) {
    return (
      <Screen title="Receipt" onBack={() => navigation.goBack()}>
        <ConnectionGate error={error}>
          <Text style={[typography.body, { color: theme.muted }]}>
            This transaction is no longer available.
          </Text>
        </ConnectionGate>
      </Screen>
    );
  }

  const outgoing = OUTGOING.has(tx.direction);
  const signedValue = outgoing ? -tx.amount : tx.amount;
  const tone = outgoing ? theme.danger : theme.success;
  const isEgress = tx.direction === 'egress';
  const isCrossAsset = !!tx.assetOut;

  // Egress ref encodes lot fill honesty as `redeem-<filled>of<requested>lots`
  // (partial) or `redeem-<filled>lots` (full) — see qpayService.redeemFxrp.
  const lotMatch = isEgress ? tx.ref.match(/^redeem-(\d+)(?:of(\d+))?lots$/) : null;
  const filledLots = lotMatch ? Number(lotMatch[1]) : null;
  const requestedLots = lotMatch && lotMatch[2] ? Number(lotMatch[2]) : filledLots;

  return (
    <Screen title="Receipt" onBack={() => navigation.goBack()}>
      <SlideIn distance={12}>
        <View style={styles.head}>
          <View style={[styles.directionBadge, { borderColor: tone }]}>
            <Icon name={outgoing ? 'arrowUpRight' : 'arrowDownLeft'} size={20} color={tone} />
          </View>
          <AmountDisplay
            value={signedValue}
            asset={tx.asset}
            size="display"
            caption={`${directionLabel(tx.direction)} · ${statusLabel(tx.status)}`}
          />
        </View>

        <View style={styles.counterparty}>
          <Avatar name={tx.counterparty} size={48} />
          <View style={styles.counterpartyText}>
            <Text style={[typography.caption, { color: theme.muted }]}>
              {outgoing ? 'TO' : 'FROM'}
            </Text>
            <Text style={[typography.bodyMedium, { color: theme.ink }]} numberOfLines={1}>
              {tx.counterparty}
            </Text>
          </View>
          {tx.status !== 'confirmed' ? <StatusTag label={statusLabel(tx.status)} /> : null}
        </View>
      </SlideIn>

      {isCrossAsset ? (
        <FadeIn delay={60}>
          <View style={styles.section}>
            <SectionLabel>Conversion</SectionLabel>
            <Card padded={false} style={styles.card}>
              <Row label="You sent" value={formatAmount(tx.amount, tx.asset)} />
              <Divider />
              <Row label="They received" value={formatAmount(tx.amountOut ?? 0, tx.assetOut ?? '')} />
            </Card>
          </View>
        </FadeIn>
      ) : null}

      {isEgress ? (
        <FadeIn delay={80}>
          <View style={styles.section}>
            <SectionLabel>Redemption</SectionLabel>
            <Card padded={false} style={styles.card}>
              <Row
                label="Lots filled"
                value={
                  filledLots != null
                    ? `${filledLots} × ${LOT_SIZE} XRP${
                        requestedLots && requestedLots !== filledLots ? ` of ${requestedLots} requested` : ''
                      }`
                    : `${(tx.amount / LOT_SIZE).toFixed(0)} × ${LOT_SIZE} XRP`
                }
              />
              <Divider />
              <Row label="Sent to XRPL" value={formatAmount(tx.amount, 'XRP')} />
              {tx.status === 'partial' && requestedLots && filledLots != null ? (
                <>
                  <Divider />
                  <Row
                    label="Unfilled lots"
                    value={`${requestedLots - filledLots} — never debited, still spendable`}
                  />
                </>
              ) : null}
            </Card>
          </View>
        </FadeIn>
      ) : null}

      <FadeIn delay={100}>
        <View style={styles.section}>
          <SectionLabel>Details</SectionLabel>
          <Card padded={false} style={styles.card}>
            <Row label="Status" value={statusLabel(tx.status)} />
            <Divider />
            <Row label="Date" value={new Date(tx.timestamp).toLocaleString()} />
            <Divider />
            <Row label="Reference" value={tx.ref} />
            {tx.note ? (
              <>
                <Divider />
                <Row label="Note" value={tx.note} />
              </>
            ) : null}
          </Card>
        </View>
      </FadeIn>

      <FadeIn delay={130}>
        <View style={styles.section}>
          <SectionLabel>On-chain proof</SectionLabel>
          <Card padded={false} style={styles.card}>
            <Row label="Transaction hash" value={truncateAddress(tx.txHash)} onPress={() => copy(tx.txHash)} />
            <Divider />
            <View style={styles.explorerRow}>
              <Text
                style={[typography.body, styles.explorerLabel, { color: theme.ink }]}
                onPress={() => Linking.openURL(tx.blockExplorerUrl)}
              >
                View on block explorer
              </Text>
              <Icon name="arrowUpRight" size={16} color={theme.muted} />
            </View>
          </Card>
          <Text style={[typography.label, styles.hashHint, { color: theme.muted }]}>
            Tap the hash to copy it.
          </Text>
        </View>
      </FadeIn>

      <Toast message="Copied" visible={toast} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xl },
  directionBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  counterparty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  counterpartyText: { flex: 1, gap: 2 },
  section: { marginBottom: spacing.lg },
  card: { paddingHorizontal: spacing.md },
  explorerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  explorerLabel: { flex: 1 },
  hashHint: { marginTop: spacing.xs },
});
