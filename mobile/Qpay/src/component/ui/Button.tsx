import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, motion, radii, spacing, typography } from '../../theme/theme';
import { PressableScale } from '../motion/PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'lg';
  style?: ViewStyle;
};

/**
 * Small consistent radius (`radii.md`) instead of the old hard 0 — still a
 * rectangle, just softened enough to read as a modern tap target.
 *   primary   — filled ink, paper text
 *   secondary — paper fill, 1px ink border, ink text
 *   ghost     — no fill, no border, ink text (for tertiary actions only)
 *
 * Press state still *inverts* the fill (there's no accent to darken toward
 * for a full-bleed CTA) but now springs down slightly too, via
 * `PressableScale`. The label/spinner swap on `loading` crossfades instead
 * of popping.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  size = 'md',
  style,
}: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const [renderLoading, setRenderLoading] = useState(!!loading);
  const contentOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (renderLoading === !!loading) return;
    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: motion.durations.instant,
      easing: motion.easing.accelerate,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setRenderLoading(!!loading);
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: motion.durations.instant,
        easing: motion.easing.decelerate,
        useNativeDriver: true,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => {
        const inverted = pressed && !isDisabled;
        const filled = variant === 'primary' ? !inverted : inverted;

        return [
          styles.base,
          size === 'lg' ? styles.lg : styles.md,
          {
            backgroundColor: filled ? theme.ink : theme.paper,
            borderColor: variant === 'ghost' ? 'transparent' : theme.ink,
            borderWidth: variant === 'ghost' ? 0 : borderWidth,
            opacity: isDisabled ? 0.35 : 1,
          },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const inverted = pressed && !isDisabled;
        const filled = variant === 'primary' ? !inverted : inverted;
        const fg = filled ? theme.paper : theme.ink;

        return (
          <Animated.View style={{ opacity: contentOpacity }}>
            {renderLoading ? (
              <ActivityIndicator color={fg} size="small" />
            ) : (
              <Text style={[typography.bodyMedium, styles.label, { color: fg }]}>{label}</Text>
            )}
          </Animated.View>
        );
      }}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
  lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, minHeight: 60 },
  label: { letterSpacing: 0.2 },
});
