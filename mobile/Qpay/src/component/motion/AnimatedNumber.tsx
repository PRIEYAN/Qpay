import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { motion } from '../../theme/theme';
import { useAnimatedNumber } from './useAnimatedNumber';

type Props = {
  value: number;
  /** Formats the in-flight numeric value for display. Default: 2dp fixed. */
  formatter?: (n: number) => string;
  duration?: number;
  /** If true, counts up from 0 on first mount instead of appearing instantly. Default false. */
  animateOnMount?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

/**
 * Rolls from the previous numeric value to the new one instead of snapping —
 * this is what makes a balance read as *live* data rather than a static
 * label. See `useAnimatedNumber` for the mechanism (also used directly by
 * `AmountDisplay`, which needs to split whole/fraction into two styles).
 */
export function AnimatedNumber({
  value,
  formatter = (n) => n.toFixed(2),
  duration = motion.durations.slow,
  animateOnMount = false,
  style,
  numberOfLines,
}: Props) {
  const animated = useAnimatedNumber(value, { duration, animateOnMount });

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {formatter(animated)}
    </Text>
  );
}
