import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radii } from '../../theme/theme';
import { Shimmer } from '../motion/Shimmer';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
};

/** Loading placeholder — a flat block with a soft `Shimmer` sweep, clipped to its own bounds. */
export function Skeleton({ width = '100%', height = 16, style }: Props) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width, height, backgroundColor: theme.border }, style]}
    >
      <Shimmer />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.sm, overflow: 'hidden' },
});
