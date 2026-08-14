import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, borderWidthStrong, elevation, radii, spacing } from '../../theme/theme';
import { PressableScale } from '../motion/PressableScale';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  /** Selected inverts the whole card to filled ink — not a badge or a tint (§3.4). */
  selected?: boolean;
  /** `flat` drops the border and uses the neutral surface fill instead. */
  variant?: 'outlined' | 'flat';
  /** `flat` cards only: sit one step higher on the surface ramp (lighter on dark, shadowed on light). */
  raised?: boolean;
  padded?: boolean;
  style?: ViewStyle;
};

/**
 * Small consistent radius (`radii.md`) — depth still comes mostly from
 * contrast, but `raised` flat cards can now sit visibly above the page:
 * on dark theme via `surfaceRaised` (a lighter grey — a shadow would be
 * invisible on black), on light theme via a real soft shadow (`elevation`).
 *
 * Press feedback still reuses the `selected` ink/paper inversion, now
 * layered with a `PressableScale` spring so a tappable card also gives
 * tactile feedback, not just a color flip.
 */
export function Card({
  children,
  onPress,
  selected,
  variant = 'outlined',
  raised = false,
  padded = true,
  style,
}: Props) {
  const theme = useTheme();

  const renderContent = (pressed: boolean) => {
    const filled = selected || (pressed && !!onPress);
    const base: ViewStyle =
      variant === 'flat'
        ? {
            backgroundColor: filled ? theme.ink : raised ? theme.surfaceRaised : theme.surface,
            borderWidth: 0,
            ...(raised && !filled && !theme.isDark ? elevation.sm : null),
          }
        : {
            backgroundColor: filled ? theme.ink : theme.paper,
            borderColor: theme.ink,
            borderWidth: filled ? borderWidthStrong : borderWidth,
          };

    return <View style={[styles.base, padded && styles.padded, base, style]}>{children}</View>;
  };

  if (!onPress) return renderContent(false);
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      {({ pressed }) => renderContent(pressed)}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.md },
  padded: { padding: spacing.md },
});
