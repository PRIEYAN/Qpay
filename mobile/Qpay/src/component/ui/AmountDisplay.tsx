import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { motion, spacing, typography } from '../../theme/theme';
import { useAnimatedNumber } from '../motion/useAnimatedNumber';

type Props = {
  value: number | null;
  asset: string;
  caption?: string;
  size?: 'display' | 'amount';
};

/**
 * The number *is* the hierarchy (§3.3) — no small-caption-plus-big-number
 * trick. Integer and fractional parts are split so the decimals can drop to
 * muted weight, which keeps a long balance readable without shrinking the
 * figure that matters.
 *
 * The value now rolls to a new figure instead of snapping (`useAnimatedNumber`
 * — the same mechanism behind `AnimatedNumber`) — this is the single
 * biggest "is this balance live data or a static label" tell in the app.
 */
export function AmountDisplay({ value, asset, caption, size = 'amount' }: Props) {
  const theme = useTheme();
  const style = size === 'display' ? typography.display : typography.amount;
  const animated = useAnimatedNumber(value ?? 0, { duration: motion.durations.slow });

  const [whole, fraction] =
    value === null ? ['—', null] : animated.toFixed(2).split('.');

  return (
    <View>
      <View style={styles.row}>
        <Text style={[style, { color: theme.ink }]}>
          {whole}
          {fraction ? <Text style={{ color: theme.muted }}>.{fraction}</Text> : null}
        </Text>
        <Text style={[typography.subtitle, styles.asset, { color: theme.muted }]}>{asset}</Text>
      </View>
      {caption ? (
        <Text style={[typography.caption, styles.caption, { color: theme.muted }]}>
          {caption.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  asset: { marginBottom: 2 },
  caption: { marginTop: spacing.sm },
});
