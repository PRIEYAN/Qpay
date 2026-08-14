import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radii, spacing, typography } from '../../theme/theme';
import { Icon, StatusTag } from '../../component/ui';
import { PressableScale, SlideIn } from '../../component/motion';
import { formatRelativeTime } from '../../utils';
import { Transaction, TransactionDirection } from '../../services/qpayService';

const OUTGOING_DIRECTIONS = new Set<TransactionDirection>(['sent', 'egress']);

export function directionLabel(direction: TransactionDirection): string {
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

type Props = {
  tx: Transaction;
  onPress: () => void;
  /** Stagger this row's mount by its position in the list — see ListRow's `index` for the same pattern. */
  index?: number;
};

/**
 * Transaction row with a leading directional icon (arrowUpRight for money
 * out, arrowDownLeft for money in) and the amount tinted success/danger —
 * the one place in the app color is allowed to carry money direction, per
 * the design brief. Everything else (row background, avatar-less layout)
 * still follows ListRow's ink/paper press inversion so it sits naturally
 * next to it.
 */
export function TransactionRow({ tx, onPress, index }: Props) {
  const theme = useTheme();
  const outgoing = OUTGOING_DIRECTIONS.has(tx.direction);
  const tone = outgoing ? theme.danger : theme.success;

  const content = (
    <PressableScale onPress={onPress} accessibilityRole="button">
      {({ pressed }) => {
        const fg = pressed ? theme.paper : theme.ink;
        const mutedFg = pressed ? theme.paper : theme.muted;
        const amountColor = pressed ? theme.paper : tone;

        return (
          <View style={[styles.row, { borderRadius: radii.sm }, pressed && { backgroundColor: theme.ink }]}>
            <View
              style={[
                styles.iconWrap,
                {
                  borderColor: pressed ? theme.paper : theme.border,
                  backgroundColor: pressed ? theme.ink : theme.surface,
                },
              ]}
            >
              <Icon name={outgoing ? 'arrowUpRight' : 'arrowDownLeft'} size={16} color={pressed ? theme.paper : tone} />
            </View>

            <View style={styles.text}>
              <Text style={[typography.bodyMedium, { color: fg }]} numberOfLines={1}>
                {tx.counterparty}
              </Text>
              <Text style={[typography.label, { color: mutedFg }]} numberOfLines={1}>
                {directionLabel(tx.direction)} · {formatRelativeTime(tx.timestamp)}
              </Text>
              {tx.status !== 'confirmed' ? (
                <View style={styles.tagWrap}>
                  <StatusTag label={tx.status} />
                </View>
              ) : null}
            </View>

            <View style={styles.valueBlock}>
              <Text style={[typography.bodyMedium, { color: amountColor }]}>
                {outgoing ? '−' : '+'}
                {tx.amount.toFixed(2)}
              </Text>
              <Text style={[typography.micro, { color: mutedFg }]}>{tx.asset}</Text>
            </View>
          </View>
        );
      }}
    </PressableScale>
  );

  if (index === undefined) return content;
  return (
    <SlideIn delay={index * 40} distance={10}>
      {content}
    </SlideIn>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  tagWrap: { marginTop: spacing.xs },
  valueBlock: { alignItems: 'flex-end', gap: 2 },
});
